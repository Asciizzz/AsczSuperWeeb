import type { AwgpuBuffer } from "./buffer.js";
import type { AwgpuTexture, AwgpuSampler } from "./target.js";

/**
 * Standardized 4-tier WebGPU bind group frequency slots.
 */
export enum AwgpuBindSlot {
    Pass = 0,       // Updated once per pass (ViewProj, Viewport, Time, Globals)
    Phase = 1,      // Updated once per phase (Light arrays, Shadow depth maps, Comparison samplers)
    Material = 2,   // Updated per material switch (Material parameters, Color/Normal textures, Standard samplers)
    Instance = 3,   // Updated per draw/batch (Model matrix, Normal matrix, Bone palette storage)
}

/**
 * Fluent builder for creating GPUBindGroupLayout descriptors.
 */
export class AwgpuBindGroupLayoutBuilder {
    private entries: GPUBindGroupLayoutEntry[] = [];

    addUniform(
        binding: number,
        visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT
    ): this {
        this.entries.push({
            binding,
            visibility,
            buffer: { type: "uniform" },
        });
        return this;
    }

    addStorage(
        binding: number,
        visibility: GPUShaderStageFlags = GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
        options: { readOnly?: boolean } = {}
    ): this {
        const type: GPUBufferBindingType = (options.readOnly ?? true) ? "read-only-storage" : "storage";
        this.entries.push({
            binding,
            visibility,
            buffer: { type },
        });
        return this;
    }

    addTexture(
        binding: number,
        visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
        options: {
            sampleType?: GPUTextureSampleType;
            viewDimension?: GPUTextureViewDimension;
        } = {}
    ): this {
        this.entries.push({
            binding,
            visibility,
            texture: {
                sampleType: options.sampleType ?? "float",
                viewDimension: options.viewDimension ?? "2d",
            },
        });
        return this;
    }

    addDepthTexture(
        binding: number,
        visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
        options: { viewDimension?: GPUTextureViewDimension } = {}
    ): this {
        this.entries.push({
            binding,
            visibility,
            texture: {
                sampleType: "depth",
                viewDimension: options.viewDimension ?? "2d",
            },
        });
        return this;
    }

    addSampler(
        binding: number,
        visibility: GPUShaderStageFlags = GPUShaderStage.FRAGMENT,
        options: { comparison?: boolean } = {}
    ): this {
        this.entries.push({
            binding,
            visibility,
            sampler: {
                type: options.comparison ? "comparison" : "filtering",
            },
        });
        return this;
    }

    build(device: GPUDevice, label = "AwgpuBindGroupLayout"): GPUBindGroupLayout {
        return device.createBindGroupLayout({
            label,
            entries: this.entries,
        });
    }
}

export type AwgpuResourceBinding =
    | GPUBufferBinding
    | GPUTextureView
    | GPUSampler
    | AwgpuBuffer
    | AwgpuTexture
    | AwgpuSampler;

export interface AwgpuBindingEntry {
    binding: number;
    resource: AwgpuResourceBinding;
}

/**
 * GPU bind group wrapper tracking slot index and layout.
 */
export class AwgpuBindGroup {
    readonly gpuBindGroup: GPUBindGroup;
    readonly layout: GPUBindGroupLayout;
    readonly slot: number;
    readonly label: string;

    constructor(
        gpuBindGroup: GPUBindGroup,
        layout: GPUBindGroupLayout,
        slot: number = AwgpuBindSlot.Pass,
        label = "AwgpuBindGroup"
    ) {
        this.gpuBindGroup = gpuBindGroup;
        this.layout = layout;
        this.slot = slot;
        this.label = label;
    }

    /**
     * Resolves resource wrappers into native GPUBindingResource descriptors.
     */
    static resolveResource(res: AwgpuResourceBinding): GPUBindingResource {
        if ("gpuBuffer" in res) {
            return { buffer: res.gpuBuffer };
        }
        if ("gpuView" in res) {
            return res.gpuView;
        }
        if ("gpuSampler" in res) {
            return res.gpuSampler;
        }
        return res as GPUBindingResource;
    }

    /**
     * Factory: Creates GPUBindGroup from typed entries.
     */
    static create(
        device: GPUDevice,
        layout: GPUBindGroupLayout,
        entries: AwgpuBindingEntry[],
        options: { slot?: number; label?: string } = {}
    ): AwgpuBindGroup {
        const label = options.label ?? "AwgpuBindGroup";
        const slot = options.slot ?? AwgpuBindSlot.Pass;

        const resolvedEntries: GPUBindGroupEntry[] = entries.map((e) => ({
            binding: e.binding,
            resource: AwgpuBindGroup.resolveResource(e.resource),
        }));

        const gpuBindGroup = device.createBindGroup({
            label,
            layout,
            entries: resolvedEntries,
        });

        return new AwgpuBindGroup(gpuBindGroup, layout, slot, label);
    }
}
