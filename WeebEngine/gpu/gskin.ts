import { AwgpuBuffer } from "../../Atoolkit/awgpu/index.js";
import { Skeleton } from "../assets/skeleton.js";

let nextGpuSkinId = 0;

/**
 * GPU skinning buffer resource wrapper.
 * Holds joint palette GPU storage buffer and CPU staging scratchpad.
 */
export class GpuSkin {
    readonly id: number;
    name: string;
    readonly jointCount: number;
    readonly jointPaletteBuffer: AwgpuBuffer;
    readonly jointPalette: Float32Array;

    constructor(
        jointCount: number,
        jointPaletteBuffer: AwgpuBuffer,
        jointPalette?: Float32Array,
        name = "GpuSkin"
    ) {
        this.id = ++nextGpuSkinId;
        this.name = name;
        this.jointCount = Math.max(1, jointCount);
        this.jointPaletteBuffer = jointPaletteBuffer;
        this.jointPalette = jointPalette ?? new Float32Array(this.jointCount * 16);
    }

    update(device: GPUDevice, palette?: Float32Array): void {
        const src = palette ?? this.jointPalette;
        this.jointPaletteBuffer.write(device, src);
    }

    destroy(): void {
        this.jointPaletteBuffer.destroy();
    }

    static fromSkeleton(device: GPUDevice, skeleton: Skeleton): GpuSkin {
        const count = Math.max(1, skeleton.joints.length);
        const palette = new Float32Array(count * 16);

        // Populate with identity matrices initially
        for (let i = 0; i < count; i++) {
            const off = i * 16;
            palette[off + 0] = 1;
            palette[off + 5] = 1;
            palette[off + 10] = 1;
            palette[off + 15] = 1;
        }

        const buffer = AwgpuBuffer.createStorage(device, palette, {
            label: `${skeleton.name}_JointPalette`,
        });

        return new GpuSkin(count, buffer, palette, skeleton.name);
    }
}
