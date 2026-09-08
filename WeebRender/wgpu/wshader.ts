import { GpuShader } from "../gpu.js";
import type { ShaderCircuit } from "../shader/circuit.js";
import type { TextureSampleNode } from "../shader/nodes.js";
import type { ShaderParamLayout } from "../shader/types.js";
import { ShaderParamsCmp } from "../shader/params.js";
import type { ShaderParamRecord, ShaderParamValue } from "../shadercmp.js";
import { compileWgsl, type WgslCompileOptions } from "./wgsl.js";

let gShaderIdCounter = 0;

export interface WgpuShaderOptions extends WgslCompileOptions {}

export interface WgpuShaderPayload {
    pipeline: GPURenderPipeline | null;
    materialBindGroupLayout: GPUBindGroupLayout | null;
    textureBindGroupLayout: GPUBindGroupLayout | null;
    skinBindGroupLayout: GPUBindGroupLayout | null;
}

/**
 * WebGPU GPU-resident Shader wrapper.
 * Manages GPURenderPipeline, GPUBindGroupLayout, and WGSL shader modules.
 * Extends GpuShader<WgpuShaderPayload> to provide typed WebGPU pipeline management.
 */
export class WgpuShader extends GpuShader<WgpuShaderPayload> {
    readonly numericId: number;
    readonly skinned: boolean;
    cullMode: GPUCullMode;
    topology: GPUPrimitiveTopology;
    readonly codeStatic: string;
    readonly codeSkinned: string;

    pipeline: GPURenderPipeline | null = null;
    materialBindGroupLayout: GPUBindGroupLayout | null = null;
    textureBindGroupLayout: GPUBindGroupLayout | null = null;
    skinBindGroupLayout: GPUBindGroupLayout | null = null;

    private pipelinesByKey = new Map<string, GPURenderPipeline>();
    private shaderModulesByKey = new Map<string, GPUShaderModule>();
    private pipelineLayoutsByKey = new Map<string, GPUPipelineLayout>();
    private shaderModule: GPUShaderModule | null = null;
    private pipelineLayout: GPUPipelineLayout | null = null;

    constructor(circuit: ShaderCircuit, options: WgpuShaderOptions = {}) {
        const compiled = compileWgsl(circuit, options);
        if (!compiled) {
            throw new Error(`[WgpuShader] Failed to compile ShaderCircuit "${circuit.name}": ${circuit.diag.lastErr()?.raw ?? "unknown error"}`);
        }
        super(circuit.name, circuit, compiled.paramLayout, compiled.textureNodes, {
            pipeline: null,
            materialBindGroupLayout: null,
            textureBindGroupLayout: null,
            skinBindGroupLayout: null,
        }, true);
        this.numericId = ++gShaderIdCounter;
        this.codeStatic = compiled.codeStatic;
        this.codeSkinned = compiled.codeSkinned;
        this.skinned = !!options.skinned;
        this.cullMode = (options.cullMode as GPUCullMode) ?? "back";
        this.topology = (options.topology as GPUPrimitiveTopology) ?? "triangle-list";
    }

    destroy(): void {
        this.invalidateGpu();
    }

    get code(): string {
        return this.codeStatic;
    }

    getCode(skinned = false): string {
        return skinned ? this.codeSkinned : this.codeStatic;
    }

    /**
     * Clears all cached GPU pipelines to allow hot-reloading or recompilation.
     */
    invalidateGpu(): void {
        this.pipeline = null;
        this.pipelinesByKey.clear();
        this.shaderModulesByKey.clear();
        this.pipelineLayoutsByKey.clear();
        this.materialBindGroupLayout = null;
        this.textureBindGroupLayout = null;
        this.skinBindGroupLayout = null;
        this.shaderModule = null;
        this.pipelineLayout = null;
    }

    /**
     * Gets or creates a render pipeline adapted to the specified vertex stride and skinning state.
     */
    getOrCreatePipeline(
        device: GPUDevice,
        format: GPUTextureFormat,
        stride: number = 32,
        isSkinnedOrCameraLayout?: boolean | GPUBindGroupLayout,
        cameraOrObjectLayout?: GPUBindGroupLayout,
        objectOrSkinLayout?: GPUBindGroupLayout,
        maybeSkinLayout?: GPUBindGroupLayout
    ): GPURenderPipeline {
        let isSkinned = stride === 64;
        let cameraBindGroupLayout: GPUBindGroupLayout;
        let objectBindGroupLayout: GPUBindGroupLayout;
        let skinBindGroupLayout: GPUBindGroupLayout | undefined;

        if (typeof isSkinnedOrCameraLayout === "boolean") {
            isSkinned = isSkinnedOrCameraLayout;
            cameraBindGroupLayout = cameraOrObjectLayout!;
            objectBindGroupLayout = objectOrSkinLayout!;
            skinBindGroupLayout = maybeSkinLayout;
        } else {
            cameraBindGroupLayout = isSkinnedOrCameraLayout!;
            objectBindGroupLayout = cameraOrObjectLayout!;
            skinBindGroupLayout = objectOrSkinLayout;
        }

        const pipelineKey = `${stride}_${isSkinned ? "skinned" : "static"}`;
        const cached = this.pipelinesByKey.get(pipelineKey);
        if (cached) return cached;

        // 1. Compile WGSL Shader Module per pipeline key if not already compiled
        let shaderModule = this.shaderModulesByKey.get(pipelineKey);
        if (!shaderModule) {
            const shaderCode = isSkinned ? this.codeSkinned : this.codeStatic;
            shaderModule = device.createShaderModule({
                label: `ShaderModule_${this.name}_${this.id}_${pipelineKey}`,
                code: shaderCode,
            });
            this.shaderModulesByKey.set(pipelineKey, shaderModule);
        }
        this.shaderModule = shaderModule;

        // 2. Base Bind Group Layouts (Camera at 0, Object at 1)
        const bindGroupLayouts: GPUBindGroupLayout[] = [
            cameraBindGroupLayout,
            objectBindGroupLayout,
        ];

        // 3. Create Material & Texture Bind Group Layout (Group 2)
        if (!this.materialBindGroupLayout) {
            const materialEntries: GPUBindGroupLayoutEntry[] = [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ];

            for (let i = 0; i < this.textureNodes.length; i++) {
                materialEntries.push(
                    {
                        binding: 1 + i * 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        texture: { sampleType: "float" },
                    },
                    {
                        binding: 2 + i * 2,
                        visibility: GPUShaderStage.FRAGMENT,
                        sampler: { type: "filtering" },
                    }
                );
            }

            this.materialBindGroupLayout = device.createBindGroupLayout({
                label: `MaterialBindGroupLayout_${this.name}_${this.id}`,
                entries: materialEntries,
            });
        }
        bindGroupLayouts.push(this.materialBindGroupLayout);

        // 4. Skin Bind Group Layout (Group 3) if skinned
        if (isSkinned) {
            if (!this.skinBindGroupLayout) {
                this.skinBindGroupLayout = skinBindGroupLayout ?? device.createBindGroupLayout({
                    label: `SkinBindGroupLayout_${this.name}_${this.id}`,
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.VERTEX,
                            buffer: { type: "read-only-storage" },
                        },
                    ],
                });
            }
            bindGroupLayouts.push(this.skinBindGroupLayout);
        }

        // 5. Create Pipeline Layout per pipeline key
        let pipelineLayout = this.pipelineLayoutsByKey.get(pipelineKey);
        if (!pipelineLayout) {
            pipelineLayout = device.createPipelineLayout({
                label: `PipelineLayout_${this.name}_${this.id}_${pipelineKey}`,
                bindGroupLayouts,
            });
            this.pipelineLayoutsByKey.set(pipelineKey, pipelineLayout);
        }
        this.pipelineLayout = pipelineLayout;

        // 6. Create Render Pipeline adapted to vertex stride and skinning state
        const vertexBuffers: GPUVertexBufferLayout[] = [
            isSkinned
                ? {
                    arrayStride: 64,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                        { shaderLocation: 1, offset: 12, format: "float32x3" },
                        { shaderLocation: 2, offset: 24, format: "float32x2" },
                        { shaderLocation: 3, offset: 32, format: "uint32x4" },
                        { shaderLocation: 4, offset: 48, format: "float32x4" },
                    ],
                }
                : {
                    arrayStride: stride,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x3" },
                        { shaderLocation: 1, offset: 12, format: "float32x3" },
                        { shaderLocation: 2, offset: 24, format: "float32x2" },
                    ],
                },
        ];

        const pipeline = device.createRenderPipeline({
            label: `RenderPipeline_${this.name}_${this.id}_${pipelineKey}`,
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [{ format }],
            },
            primitive: {
                topology: this.topology,
                cullMode: this.cullMode,
            },
            depthStencil: {
                format: "depth24plus",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
        });

        this.pipelinesByKey.set(pipelineKey, pipeline);
        this.pipeline = pipeline;
        return pipeline;
    }

    /**
     * Compiles the WebGPU render pipeline for this shader.
     */
    initGpu(
        device: GPUDevice,
        format: GPUTextureFormat,
        cameraBindGroupLayout: GPUBindGroupLayout,
        objectBindGroupLayout: GPUBindGroupLayout,
        skinBindGroupLayout?: GPUBindGroupLayout
    ): void {
        this.getOrCreatePipeline(
            device,
            format,
            this.skinned ? 64 : 32,
            cameraBindGroupLayout,
            objectBindGroupLayout,
            skinBindGroupLayout
        );
    }

    /**
     * Creates a new parameter record populated with this shader's default uniform and texture values.
     */
    createDefaultParams(): ShaderParamRecord {
        const params: ShaderParamRecord = {};
        if (this.paramLayout) {
            for (const [name, u] of this.paramLayout.uniforms) {
                params[name] = Array.isArray(u.defaultValue) ? [...u.defaultValue] : u.defaultValue;
            }
            for (const [name, t] of this.paramLayout.textures) {
                params[name] = t.defaultTexture as any;
            }
        }
        return params;
    }

    /**
     * Creates a ShaderParamsCmp pre-populated with this shader's default parameters and optional overrides.
     */
    createParamsCmp(overrides?: ShaderParamRecord): ShaderParamsCmp {
        const params = this.createDefaultParams();
        if (overrides) {
            Object.assign(params, overrides);
        }
        return new ShaderParamsCmp(params, this as any);
    }

    /**
     * Retrieves the default value for a single uniform or texture parameter by name.
     */
    getDefaultParam(name: string): ShaderParamValue | undefined {
        if (!this.paramLayout) return undefined;
        const u = this.paramLayout.uniforms.get(name);
        if (u) {
            return Array.isArray(u.defaultValue) ? [...u.defaultValue] : u.defaultValue;
        }
        const t = this.paramLayout.textures.get(name);
        if (t) {
            return t.defaultTexture as any;
        }
        return undefined;
    }

    /**
     * Returns true if this shader exposes a parameter with the specified name.
     */
    hasParam(name: string): boolean {
        if (!this.paramLayout) return false;
        return this.paramLayout.uniforms.has(name) || this.paramLayout.textures.has(name);
    }

    /**
     * Returns an array of all parameter names exposed by this shader.
     */
    getParamNames(): string[] {
        if (!this.paramLayout) return [];
        return [
            ...this.paramLayout.uniforms.keys(),
            ...this.paramLayout.textures.keys(),
        ];
    }
}

// Ergonomic alias
export { WgpuShader as GShader };

