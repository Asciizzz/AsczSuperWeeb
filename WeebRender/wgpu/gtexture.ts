import type { Texture } from "../texture.js";

let gTextureIdCounter = 0;

export interface GTextureOptions {
    name?: string;
    sampler?: GPUSampler;
    label?: string;
}

export interface GTextureRefOptions {
    name?: string;
    view?: GPUTextureView;
    sampler?: GPUSampler;
    width?: number;
    height?: number;
}

/**
 * WebGPU GPU-resident Texture wrapper.
 * Holds GPUTexture, GPUTextureView, and GPUSampler directly.
 * Can self-allocate resources (gpuOwned = true) or reference external resources (gpuOwned = false).
 */
export class GTexture {
    readonly id: number;
    name: string;
    gpuTexture: GPUTexture;
    gpuView: GPUTextureView;
    gpuSampler: GPUSampler;
    width: number;
    height: number;
    gpuOwned: boolean;
    cpuTexture?: Texture;

    constructor(
        name = "GTexture",
        gpuTexture: GPUTexture,
        gpuView: GPUTextureView,
        gpuSampler: GPUSampler,
        width = 1,
        height = 1,
        gpuOwned = false
    ) {
        this.id = ++gTextureIdCounter;
        this.name = name;
        this.gpuTexture = gpuTexture;
        this.gpuView = gpuView;
        this.gpuSampler = gpuSampler;
        this.width = width;
        this.height = height;
        this.gpuOwned = gpuOwned;
    }

    /**
     * Allocates a WebGPU texture, view, and sampler from a CPU Texture asset and copies pixel data.
     * Marks the GPU resources as owned by this GTexture instance.
     */
    static fromTexture(device: GPUDevice, texture: Texture, options?: GTextureOptions): GTexture {
        const width = Math.max(1, texture.width);
        const height = Math.max(1, texture.height);

        const gpuTexture = device.createTexture({
            label: options?.label ?? `GTexture_${texture.name}_${texture.id}`,
            size: [width, height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        if (texture.data) {
            device.queue.writeTexture(
                { texture: gpuTexture },
                texture.data.buffer as ArrayBuffer,
                { bytesPerRow: width * 4 },
                { width, height }
            );
        }

        const gpuView = gpuTexture.createView();
        const gpuSampler = options?.sampler ?? device.createSampler({
            label: `GSampler_${texture.name}_${texture.id}`,
            magFilter: "linear",
            minFilter: "linear",
        });

        const gTex = new GTexture(
            options?.name ?? texture.name,
            gpuTexture,
            gpuView,
            gpuSampler,
            width,
            height,
            true
        );
        gTex.cpuTexture = texture;
        return gTex;
    }

    /**
     * Non-owning reference wrapper for an external WebGPU texture.
     * Ideal for Render-to-Texture (RTT), offscreen passes, shadow maps, and canvas outputs.
     */
    static ref(
        gpuTexture: GPUTexture,
        options?: GTextureRefOptions
    ): GTexture {
        const view = options?.view ?? gpuTexture.createView();
        // Return a referenced GTexture; if sampler is not provided, caller or renderer can supply default
        return new GTexture(
            options?.name ?? "GTextureRef",
            gpuTexture,
            view,
            options?.sampler!,
            options?.width ?? gpuTexture.width,
            options?.height ?? gpuTexture.height,
            false
        );
    }

    /**
     * Re-uploads CPU pixel data into the existing GPU texture.
     */
    updateFromTexture(device: GPUDevice, texture: Texture): void {
        if (!texture.data) return;
        device.queue.writeTexture(
            { texture: this.gpuTexture },
            texture.data.buffer as ArrayBuffer,
            { bytesPerRow: this.width * 4 },
            { width: this.width, height: this.height }
        );
    }

    /**
     * Clears GPU resources. Only destroys the texture if it was created and owned by this instance.
     */
    destroy(): void {
        if (this.gpuOwned) {
            this.gpuTexture?.destroy();
        }
    }

    /**
     * Alias for destroy on context teardown.
     */
    invalidateGpu(): void {
        this.destroy();
    }
}
