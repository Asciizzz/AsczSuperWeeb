import { AwgpuTexture, AwgpuSampler } from "../../Atoolkit/awgpu/index.js";
import type { Texture } from "../assets/texture.js";

/**
 * Hardware GPU texture and sampler pair.
 */
export class GpuTexture {
    readonly texture: AwgpuTexture;
    readonly sampler: AwgpuSampler;

    get gpuView(): GPUTextureView {
        return this.texture.gpuView;
    }

    get gpuSampler(): GPUSampler {
        return this.sampler.gpuSampler;
    }

    constructor(
        device: GPUDevice,
        texture: Texture,
        sampler?: GPUSamplerDescriptor | AwgpuSampler
    ) {
        this.texture = AwgpuTexture.create2D(device, {
            width: texture.width,
            height: texture.height,
            format: texture.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            label: `${texture.name}_GpuTex`,
        });

        // Upload pixel data
        device.queue.writeTexture(
            { texture: this.texture.gpuTexture },
            texture.data as unknown as BufferSource,
            { bytesPerRow: texture.width * 4 },
            [texture.width, texture.height, 1]
        );

        if (sampler instanceof AwgpuSampler) {
            this.sampler = sampler;
        } else if (sampler) {
            const nativeSampler = device.createSampler({
                label: `${texture.name}_Sampler`,
                ...sampler,
            });
            this.sampler = new AwgpuSampler(nativeSampler, `${texture.name}_Sampler`);
        } else {
            this.sampler = AwgpuSampler.createLinear(device, `${texture.name}_Sampler`);
        }
    }

    static fromTexture(device: GPUDevice, texture: Texture): GpuTexture {
        return new GpuTexture(device, texture);
    }

    static createSolid(device: GPUDevice, r = 255, g = 255, b = 255, a = 255): GpuTexture {
        const raw = new Uint8Array([r, g, b, a]);
        const texture: Texture = {
            name: "SolidGpu",
            width: 1,
            height: 1,
            format: "rgba8unorm",
            data: raw,
        };
        const nearest = AwgpuSampler.createNearest(device, "SolidGpu_NearestSampler");
        return new GpuTexture(device, texture, nearest);
    }
}
