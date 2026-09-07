let textureIdCounter = 0;

export interface TextureGpuOptions {
    gpuTexture?: GPUTexture | null;
    gpuView?: GPUTextureView | null;
    gpuSampler?: GPUSampler | null;
}

/**
 * Texture asset container.
 * Holds CPU pixel data and/or direct WebGPU resource references.
 * Can self-allocate resources (gpuOwned = true) or reference external resources (gpuOwned = false).
 */
export class Texture {
    readonly id: number;
    name: string;
    width: number;
    height: number;
    data: Uint8Array | null;

    // GPU-resident resources
    gpuTexture: GPUTexture | null = null;
    gpuView: GPUTextureView | null = null;
    gpuSampler: GPUSampler | null = null;
    gpuOwned = false;

    constructor(
        name = "Texture",
        width = 1,
        height = 1,
        data: Uint8Array | null = null,
        gpuOptions?: TextureGpuOptions
    ) {
        this.id = ++textureIdCounter;
        this.name = name;
        this.width = width;
        this.height = height;
        this.data = data;
        if (gpuOptions) {
            this.gpuTexture = gpuOptions.gpuTexture ?? null;
            this.gpuView = gpuOptions.gpuView ?? null;
            this.gpuSampler = gpuOptions.gpuSampler ?? null;
            this.gpuOwned = false;
        }
    }

    /**
     * Allocates GPU texture, view, and sampler on the specified device.
     * Uploads CPU pixel data if present.
     * Marks the GPU resources as owned by this Texture instance.
     */
    gpuCreate(device: GPUDevice): this {
        if (this.gpuTexture && this.gpuView && this.gpuOwned) {
            return this;
        }

        const width = Math.max(1, this.width);
        const height = Math.max(1, this.height);

        this.gpuTexture = device.createTexture({
            label: `TexResource_${this.name}_${this.id}`,
            size: [width, height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        if (this.data) {
            device.queue.writeTexture(
                { texture: this.gpuTexture },
                this.data.buffer as ArrayBuffer,
                { bytesPerRow: width * 4 },
                { width, height }
            );
        }

        this.gpuView = this.gpuTexture.createView();
        this.gpuSampler = device.createSampler({
            label: `TexSampler_${this.name}_${this.id}`,
            magFilter: "linear",
            minFilter: "linear",
        });

        this.gpuOwned = true;
        return this;
    }

    /**
     * Attaches an external GPU texture without taking ownership.
     * Ideal for Render-to-Texture (RTT), offscreen passes, shadow maps, and canvas outputs.
     */
    ref(
        gpuTexture: GPUTexture,
        options: { view?: GPUTextureView; sampler?: GPUSampler } = {}
    ): this {
        if (this.gpuOwned) {
            this.destroy();
        }
        this.gpuTexture = gpuTexture;
        this.gpuView = options.view ?? gpuTexture.createView();
        this.gpuSampler = options.sampler ?? null;
        this.gpuOwned = false;
        return this;
    }

    /**
     * Re-uploads CPU pixel data to the existing GPU texture.
     */
    updateGpu(device: GPUDevice): void {
        if (!this.gpuTexture || !this.data) return;
        device.queue.writeTexture(
            { texture: this.gpuTexture },
            this.data.buffer as ArrayBuffer,
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
        this.gpuTexture = null;
        this.gpuView = null;
        this.gpuSampler = null;
        this.gpuOwned = false;
    }

    /**
     * Alias for destroy / invalidation on context changes.
     */
    invalidateGpu(): void {
        this.destroy();
    }
}
