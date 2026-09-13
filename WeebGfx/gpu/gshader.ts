import {
    AwgpuRenderPipeline,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindGroup,
    AwgpuBindSlot,
    AwgpuBuffer,
    createVertexLayout,
} from "../../Atoolkit/awgpu/index.js";
import { ShaderCircuit } from "../assets/shader/circuit.js";
import type { ShaderParamLayout } from "../assets/shader/types.js";
import { compileCircuitToWgsl } from "./compiler.js";
import { GpuTexture } from "./gtexture.js";

export interface GpuShaderOptions {
    targetFormat?: GPUTextureFormat;
    depthFormat?: GPUTextureFormat | null;
    label?: string;
}

/**
 * Compiled GPU shader pipelines (static and skinned) with frequency slot bindings.
 */
export class GpuShader {
    readonly label: string;
    readonly staticPipeline: AwgpuRenderPipeline;
    readonly skinnedPipeline?: AwgpuRenderPipeline;
    readonly materialLayout: GPUBindGroupLayout;
    readonly paramLayout: ShaderParamLayout;

    constructor(
        device: GPUDevice,
        circuit: ShaderCircuit,
        options: GpuShaderOptions = {}
    ) {
        this.label = options.label ?? circuit.name;
        const targetFormat = options.targetFormat ?? "bgra8unorm";
        const depthFormat = options.depthFormat === null ? undefined : (options.depthFormat ?? "depth24plus");

        const { paramLayout, textureNodes } = circuit.buildParamLayout();
        this.paramLayout = paramLayout;

        // 1. Slot 0 (Pass / Global): Uniform buffer
        const passLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)
            .build(device, `${this.label}_PassLayout`);

        // 2. Slot 2 (Material): Uniform buffer + Texture + Sampler pairs
        const materialBuilder = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.FRAGMENT);

        for (let i = 0; i < textureNodes.length; i++) {
            materialBuilder.addTexture(1 + i * 2, GPUShaderStage.FRAGMENT);
            materialBuilder.addSampler(2 + i * 2, GPUShaderStage.FRAGMENT);
        }
        this.materialLayout = materialBuilder.build(device, `${this.label}_MaterialLayout`);

        // 3. Slot 3 (Instance): Static modelMatrix uniform
        const staticInstanceLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX)
            .build(device, `${this.label}_StaticInstanceLayout`);

        // Resolve Blend Mode
        let blend: GPUBlendState | undefined;
        const blendMode = circuit.renderState.blendMode ?? "opaque";
        if (blendMode === "alpha-blend") {
            blend = {
                color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            };
        } else if (blendMode === "additive") {
            blend = {
                color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
                alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
            };
        }

        // Resolve Depth Mode
        const depthMode = circuit.renderState.depthMode ?? "read-write";
        const depthStencil: GPUDepthStencilState | undefined = depthFormat
            ? {
                  format: depthFormat,
                  depthWriteEnabled: depthMode === "read-write",
                  depthCompare: depthMode === "disabled" ? "always" : "less",
              }
            : undefined;

        // Resolve Cull Mode
        const cullMode: GPUCullMode = circuit.renderState.cullMode ?? "back";

        // Vertex layout for static mesh
        const staticVertexLayout = createVertexLayout([
            { shaderLocation: 0, format: "float32x3" },
            { shaderLocation: 1, format: "float32x3" },
            { shaderLocation: 2, format: "float32x2" },
        ]);

        const staticWgsl = compileCircuitToWgsl(circuit, { skinned: false });

        this.staticPipeline = AwgpuRenderPipeline.create(device, {
            label: `${this.label}_StaticPipeline`,
            bindGroupLayouts: [passLayout, null, this.materialLayout, staticInstanceLayout],
            vertex: {
                code: staticWgsl,
                entryPoint: "vs_main",
                buffers: [staticVertexLayout],
            },
            fragment: {
                code: staticWgsl,
                entryPoint: "fs_main",
                targets: [{ format: targetFormat, blend }],
            },
            depthStencil,
            primitive: {
                topology: "triangle-list",
                cullMode,
            },
        });

        // Optional skinned pipeline
        const skinnedInstanceLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX)
            .addStorage(1, GPUShaderStage.VERTEX, { readOnly: true })
            .build(device, `${this.label}_SkinnedInstanceLayout`);

        const skinnedVertexLayout = createVertexLayout([
            { shaderLocation: 0, format: "float32x3" },
            { shaderLocation: 1, format: "float32x3" },
            { shaderLocation: 2, format: "float32x2" },
            { shaderLocation: 3, format: "uint32x4" },
            { shaderLocation: 4, format: "float32x4" },
        ]);

        const skinnedWgsl = compileCircuitToWgsl(circuit, { skinned: true });

        this.skinnedPipeline = AwgpuRenderPipeline.create(device, {
            label: `${this.label}_SkinnedPipeline`,
            bindGroupLayouts: [passLayout, null, this.materialLayout, skinnedInstanceLayout],
            vertex: {
                code: skinnedWgsl,
                entryPoint: "vs_main",
                buffers: [skinnedVertexLayout],
            },
            fragment: {
                code: skinnedWgsl,
                entryPoint: "fs_main",
                targets: [{ format: targetFormat, blend }],
            },
            depthStencil,
            primitive: {
                topology: "triangle-list",
                cullMode,
            },
        });
    }

    createMaterialBindGroup(
        device: GPUDevice,
        uniformBuffer: AwgpuBuffer,
        textures: (GpuTexture | null)[]
    ): AwgpuBindGroup {
        const entries: { binding: number; resource: any }[] = [
            { binding: 0, resource: uniformBuffer },
        ];

        let solidFallback: GpuTexture | null = null;
        for (let i = 0; i < textures.length; i++) {
            let tex = textures[i];
            if (!tex) {
                solidFallback ??= GpuTexture.createSolid(device, 255, 255, 255, 255);
                tex = solidFallback;
            }
            entries.push({ binding: 1 + i * 2, resource: tex.texture });
            entries.push({ binding: 2 + i * 2, resource: tex.sampler });
        }

        return AwgpuBindGroup.create(device, this.materialLayout, entries, {
            slot: AwgpuBindSlot.Material,
            label: `${this.label}_MaterialBG`,
        });
    }

    static fromCircuit(device: GPUDevice, circuit: ShaderCircuit, options?: GpuShaderOptions): GpuShader {
        return new GpuShader(device, circuit, options);
    }
}
