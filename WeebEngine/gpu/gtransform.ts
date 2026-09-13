import {
    AwgpuBuffer,
    AwgpuBindSlot,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindGroup,
} from "../../Atoolkit/awgpu/index.js";
import { Mat4, type M16 } from "../../Atoolkit/alm/index.js";
import type { GpuSkin } from "./gskin.js";

let nextGpuTransformId = 0;
const layoutCache = new WeakMap<GPUDevice, { staticLayout: GPUBindGroupLayout; skinnedLayout: GPUBindGroupLayout }>();

function getOrCreateLayouts(device: GPUDevice) {
    let cached = layoutCache.get(device);
    if (!cached) {
        const staticLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX)
            .build(device, "InstanceStaticLayout");

        const skinnedLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX)
            .addStorage(1, GPUShaderStage.VERTEX, { readOnly: true })
            .build(device, "InstanceSkinnedLayout");

        cached = { staticLayout, skinnedLayout };
        layoutCache.set(device, cached);
    }
    return cached;
}

/**
 * GPU transform uniform resource wrapper.
 * Manages model matrix GPUBuffer and Instance frequency tier bind groups (slot 3).
 */
export class GpuTransform {
    readonly id: number;
    label: string;
    readonly buffer: AwgpuBuffer;
    bindGroup: AwgpuBindGroup;
    private skinnedBindGroup: AwgpuBindGroup | null = null;
    private currentSkinId = -1;

    constructor(
        buffer: AwgpuBuffer,
        bindGroup: AwgpuBindGroup,
        label = "GpuTransform"
    ) {
        this.id = ++nextGpuTransformId;
        this.label = label;
        this.buffer = buffer;
        this.bindGroup = bindGroup;
    }

    update(device: GPUDevice, worldMatrix: M16): void {
        this.buffer.write(device, worldMatrix);
    }

    getBindGroup(device: GPUDevice, skin?: GpuSkin | null): AwgpuBindGroup {
        if (!skin) {
            return this.bindGroup;
        }

        if (this.skinnedBindGroup && this.currentSkinId === skin.id) {
            return this.skinnedBindGroup;
        }

        const { skinnedLayout } = getOrCreateLayouts(device);
        this.skinnedBindGroup = AwgpuBindGroup.create(
            device,
            skinnedLayout,
            [
                { binding: 0, resource: this.buffer },
                { binding: 1, resource: skin.jointPaletteBuffer },
            ],
            { slot: AwgpuBindSlot.Instance, label: `${this.label}_SkinnedBG` }
        );
        this.currentSkinId = skin.id;
        return this.skinnedBindGroup;
    }

    destroy(): void {
        this.buffer.destroy();
    }

    static create(device: GPUDevice, initialMatrix?: M16, label = "GpuTransform"): GpuTransform {
        const mat = initialMatrix ?? Mat4.makeIdentity();
        const buffer = AwgpuBuffer.createUniform(device, mat, `${label}_ModelUBO`);

        const { staticLayout } = getOrCreateLayouts(device);
        const bindGroup = AwgpuBindGroup.create(
            device,
            staticLayout,
            [{ binding: 0, resource: buffer }],
            { slot: AwgpuBindSlot.Instance, label: `${label}_StaticBG` }
        );

        return new GpuTransform(buffer, bindGroup, label);
    }

    static getStaticLayout(device: GPUDevice): GPUBindGroupLayout {
        return getOrCreateLayouts(device).staticLayout;
    }

    static getSkinnedLayout(device: GPUDevice): GPUBindGroupLayout {
        return getOrCreateLayouts(device).skinnedLayout;
    }
}
