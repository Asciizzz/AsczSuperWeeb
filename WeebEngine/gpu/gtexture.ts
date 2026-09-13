import { AwgpuTexture, AwgpuSampler } from "../../Atoolkit/awgpu/index.js";
import { Texture } from "../assets/texture.js";

let nextGpuTextureId = 0;

/**
 * GPU texture and sampler resource wrapper.
 */
export class GpuTexture {
    readonly id: number;
    name: string;
    readonly texture: AwgpuTexture;
    readonly sampler: AwgpuSampler;

    constructor(
        texture: AwgpuTexture,
        sampler: AwgpuSampler,
        name = "GpuTexture"
    ) {
        this.id = ++nextGpuTextureId;
        this.name = name;
        this.texture = texture;
        this.sampler = sampler;
    }

    get width(): number {
        return this.texture.width;
    }

    get height(): number {
        return this.texture.height;
    }

    get gpuView(): GPUTextureView {
        return this.texture.gpuView;
    }

    get gpuSampler(): GPUSampler {
        return this.sampler.gpuSampler;
    }

    destroy(): void {
        this.texture.destroy();
    }

    static fromTexture(device: GPUDevice, cpuTexture: Texture): GpuTexture {
        const usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
        const awgpuTex = AwgpuTexture.create2D(device, {
            width: cpuTexture.width,
            height: cpuTexture.height,
            format: cpuTexture.format,
            usage,
            label: cpuTexture.name,
        });

        device.queue.writeTexture(
            { texture: awgpuTex.gpuTexture },
            cpuTexture.data as unknown as BufferSource,
            { bytesPerRow: cpuTexture.width * 4 },
            [cpuTexture.width, cpuTexture.height, 1]
        );

        const sampler = AwgpuSampler.createLinear(device, `${cpuTexture.name}_Sampler`);
        return new GpuTexture(awgpuTex, sampler, cpuTexture.name);
    }

    static createSolid(device: GPUDevice, r: number, g: number, b: number, a = 255): GpuTexture {
        const cpu = Texture.createSolid(r, g, b, a);
        return GpuTexture.fromTexture(device, cpu);
    }
}
