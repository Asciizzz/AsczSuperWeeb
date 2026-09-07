import { GpuTexture } from "../gpu.js";
import type { Texture } from "../texture.js";

export interface WgpuTexturePayload {
    gpuTexture: GPUTexture;
    gpuView: GPUTextureView;
    gpuSampler: GPUSampler;
}

export interface WgpuTextureOptions {
    name?: string;
    sampler?: GPUSampler;
    label?: string;
}

export interface WgpuTextureRefOptions {
    name?: string;
    view?: GPUTextureView;
    sampler?: GPUSampler;
    width?: number;
    height?: number;
}

/**
 * WebGPU GPU-resident Texture wrapper.
 * Extends GpuTexture<WgpuTexturePayload> to provide typed WebGPU accessors.
 */
export class WgpuTexture extends GpuTexture<WgpuTexturePayload> {
    get gpuTexture(): GPUTexture {
        return this.backend.gpuTexture;
    }

    get gpuView(): GPUTextureView {
        return this.backend.gpuView;
    }

    get gpuSampler(): GPUSampler {
        return this.backend.gpuSampler;
    }

    constructor(
        name = "WgpuTexture",
        gpuTexture: GPUTexture,
        gpuView: GPUTextureView,
        gpuSampler: GPUSampler,
        width = 1,
        height = 1,
        gpuOwned = false
    ) {
        super(name, width, height, { gpuTexture, gpuView, gpuSampler }, gpuOwned);
    }

    /**
     * Allocates a WebGPU texture, view, and sampler from a CPU Texture asset and copies pixel data.
     * Marks the GPU resources as owned by this WgpuTexture instance.
     */
    static fromTexture(device: GPUDevice, texture: Texture, options?: WgpuTextureOptions): WgpuTexture {
        const width = Math.max(1, texture.width);
        const height = Math.max(1, texture.height);

        const gpuTexture = device.createTexture({
            label: options?.label ?? `WgpuTexture_${texture.name}_${texture.id}`,
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
            label: `WSampler_${texture.name}_${texture.id}`,
            magFilter: "linear",
            minFilter: "linear",
        });

        const wTex = new WgpuTexture(
            options?.name ?? texture.name,
            gpuTexture,
            gpuView,
            gpuSampler,
            width,
            height,
            true
        );
        wTex.cpuTexture = texture;
        return wTex;
    }

    /**
     * Non-owning reference wrapper for an external WebGPU texture.
     * Ideal for Render-to-Texture (RTT), offscreen passes, shadow maps, and canvas outputs.
     */
    static ref(
        gpuTexture: GPUTexture,
        options?: WgpuTextureRefOptions
    ): WgpuTexture {
        const view = options?.view ?? gpuTexture.createView();
        return new WgpuTexture(
            options?.name ?? "WgpuTextureRef",
            gpuTexture,
            view,
            options?.sampler as GPUSampler,
            options?.width ?? gpuTexture.width,
            options?.height ?? gpuTexture.height,
            false
        );
    }

    /**
     * Updates an existing WgpuTexture with new pixel data from a CPU Texture asset.
     */
    updateFromTexture(device: GPUDevice, texture: Texture): void {
        const w = Math.min(this.width, texture.width);
        const h = Math.min(this.height, texture.height);
        if (texture.data && w > 0 && h > 0) {
            device.queue.writeTexture(
                { texture: this.gpuTexture },
                texture.data.buffer as ArrayBuffer,
                { bytesPerRow: texture.width * 4 },
                { width: w, height: h }
            );
            this.cpuTexture = texture;
        }
    }

    /**
     * Releases owned WebGPU texture resources.
     */
    destroy(): void {
        if (this.gpuOwned) {
            this.gpuTexture.destroy();
        }
    }
}

// Ergonomic aliases
export { WgpuTexture as GTexture };
export type { WgpuTextureOptions as GTextureOptions, WgpuTextureRefOptions as GTextureRefOptions };

