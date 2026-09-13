import {
    AwgpuRenderPipeline,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBuffer,
    createVertexLayout,
} from "../../Atoolkit/awgpu/index.js";
import { ShaderCircuit } from "../assets/shader/circuit.js";
import type { ShaderParamLayout } from "../assets/shader/types.js";
import { compileCircuitToWgsl } from "./compiler.js";
import { GpuTransform } from "./gtransform.js";
import { GpuMaterial } from "./gmaterial.js";
import { GpuTexture } from "./gtexture.js";

let nextShaderId = 0;
const commonLayoutCache = new WeakMap<GPUDevice, { cameraLayout: GPUBindGroupLayout; phaseLayout: GPUBindGroupLayout }>();

export function getCommonLayouts(device: GPUDevice) {
    let cached = commonLayoutCache.get(device);
    if (!cached) {
        const cameraLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)
            .build(device, "CameraPassLayout");

        const phaseLayout = device.createBindGroupLayout({ label: "EmptyPhaseLayout", entries: [] });
        cached = { cameraLayout, phaseLayout };
        commonLayoutCache.set(device, cached);
    }
    return cached;
}

export interface GpuShaderOptions {
    targetFormat?: GPUTextureFormat;
    depthFormat?: GPUTextureFormat | null;
    cullMode?: GPUCullMode;
    supportSkinning?: boolean;
}

/**
 * GPU shader pipeline resource wrapper.
 * Manages compiled WebGPU pipelines and material bind group layouts.
 */
export class GpuShader {
    readonly id: number;
    name: string;
    readonly circuit: ShaderCircuit;
    readonly paramLayout: ShaderParamLayout;
    readonly materialLayout: GPUBindGroupLayout;
    readonly staticPipeline: AwgpuRenderPipeline;
    readonly skinnedPipeline: AwgpuRenderPipeline | null;
    readonly textureCount: number;

    constructor(
        circuit: ShaderCircuit,
        paramLayout: ShaderParamLayout,
        materialLayout: GPUBindGroupLayout,
        staticPipeline: AwgpuRenderPipeline,
        skinnedPipeline: AwgpuRenderPipeline | null = null,
        textureCount = 0,
        name = "GpuShader"
    ) {
        this.id = ++nextShaderId;
        this.name = name;
        this.circuit = circuit;
        this.paramLayout = paramLayout;
        this.materialLayout = materialLayout;
        this.staticPipeline = staticPipeline;
        this.skinnedPipeline = skinnedPipeline;
        this.textureCount = textureCount;
    }

    createMaterial(
        device: GPUDevice,
        overrides?: Record<string, number | number[] | Float32Array | GpuTexture>
    ): GpuMaterial {
        const ubo = AwgpuBuffer.createUniform(device, this.paramLayout.defaultUniformData, `${this.name}_MaterialUBO`);

        const initialTextures: (GpuTexture | null)[] = new Array(this.textureCount).fill(null);

        // Populate defaults from layout
        for (const texDef of this.paramLayout.textures.values()) {
            if (texDef.defaultTexture) {
                initialTextures[texDef.textureIndex] = texDef.defaultTexture;
            }
        }

        const material = new GpuMaterial(
            this.materialLayout,
            this.paramLayout,
            ubo,
            undefined as any,
            initialTextures,
            `${this.name}_Material`
        );

        // Apply any immediate overrides
        if (overrides) {
            for (const [key, val] of Object.entries(overrides)) {
                if (val instanceof GpuTexture) {
                    const texDef = this.paramLayout.textures.get(key);
                    if (texDef) initialTextures[texDef.textureIndex] = val;
                } else {
                    const uDef = this.paramLayout.uniforms.get(key);
                    if (uDef) {
                        const off = uDef.byteOffset / 4;
                        if (typeof val === "number") material.uniformData[off] = val;
                        else material.uniformData.set(val, off);
                    }
                }
            }
            ubo.write(device, material.uniformData);
        }

        material.rebuildBindGroup(device);
        return material;
    }

    static fromCircuit(
        device: GPUDevice,
        circuit: ShaderCircuit,
        options: GpuShaderOptions = {}
    ): GpuShader {
        const sortedNodes = circuit.getExecutableNodes();
        const { paramLayout, textureNodes } = circuit.buildParamLayout(sortedNodes);

        // Build material bind group layout
        const matBuilder = new AwgpuBindGroupLayoutBuilder();
        matBuilder.addUniform(0, GPUShaderStage.FRAGMENT);
        for (let i = 0; i < textureNodes.length; i++) {
            matBuilder.addTexture(1 + i * 2, GPUShaderStage.FRAGMENT);
            matBuilder.addSampler(2 + i * 2, GPUShaderStage.FRAGMENT);
        }
        const materialLayout = matBuilder.build(device, `${circuit.name}_MaterialLayout`);

        const { cameraLayout, phaseLayout } = getCommonLayouts(device);
        const staticInstanceLayout = GpuTransform.getStaticLayout(device);
        const targetFormat = options.targetFormat ?? "bgra8unorm";
        const depthFormat = options.depthFormat ?? "depth24plus";
        const cullMode = options.cullMode ?? "none";

        // Static pipeline
        const staticWgsl = compileCircuitToWgsl(circuit, { skinned: false });
        const staticVertexLayout = createVertexLayout([
            { shaderLocation: 0, format: "float32x3", offset: 0 },
            { shaderLocation: 1, format: "float32x3", offset: 12 },
            { shaderLocation: 2, format: "float32x2", offset: 24 },
        ]);

        const staticPipeline = AwgpuRenderPipeline.create(device, {
            label: `${circuit.name}_StaticPipeline`,
            bindGroupLayouts: [cameraLayout, phaseLayout, materialLayout, staticInstanceLayout],
            vertex: {
                code: staticWgsl,
                entryPoint: "vs_main",
                buffers: [staticVertexLayout],
            },
            fragment: {
                code: staticWgsl,
                entryPoint: "fs_main",
                targets: [{ format: targetFormat }],
            },
            depthStencil: depthFormat ? {
                format: depthFormat,
                depthWriteEnabled: true,
                depthCompare: "less",
            } : undefined,
            primitive: {
                cullMode,
                topology: "triangle-list",
            },
        });

        // Optional skinned pipeline
        let skinnedPipeline: AwgpuRenderPipeline | null = null;
        if (options.supportSkinning !== false) {
            const skinnedWgsl = compileCircuitToWgsl(circuit, { skinned: true });
            const skinnedInstanceLayout = GpuTransform.getSkinnedLayout(device);
            const skinnedVertexLayout = createVertexLayout([
                { shaderLocation: 0, format: "float32x3", offset: 0 },
                { shaderLocation: 1, format: "float32x3", offset: 12 },
                { shaderLocation: 2, format: "float32x2", offset: 24 },
                { shaderLocation: 3, format: "uint32x4", offset: 32 },
                { shaderLocation: 4, format: "float32x4", offset: 48 },
            ]);

            skinnedPipeline = AwgpuRenderPipeline.create(device, {
                label: `${circuit.name}_SkinnedPipeline`,
                bindGroupLayouts: [cameraLayout, phaseLayout, materialLayout, skinnedInstanceLayout],
                vertex: {
                    code: skinnedWgsl,
                    entryPoint: "vs_main",
                    buffers: [skinnedVertexLayout],
                },
                fragment: {
                    code: skinnedWgsl,
                    entryPoint: "fs_main",
                    targets: [{ format: targetFormat }],
                },
                depthStencil: depthFormat ? {
                    format: depthFormat,
                    depthWriteEnabled: true,
                    depthCompare: "less",
                } : undefined,
                primitive: {
                    cullMode,
                    topology: "triangle-list",
                },
            });
        }

        return new GpuShader(
            circuit,
            paramLayout,
            materialLayout,
            staticPipeline,
            skinnedPipeline,
            textureNodes.length,
            circuit.name
        );
    }
}
