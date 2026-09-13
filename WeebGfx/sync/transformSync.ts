import type { ComponentSet, Entity } from "../../Atoolkit/aecs/index.js";
import { AwgpuBuffer, AwgpuBindGroup, AwgpuBindSlot } from "../../Atoolkit/awgpu/index.js";
import type { TransformCmp } from "../components/transform.js";

export interface GpuTransformBinding {
    buffer: AwgpuBuffer;
    bindGroup: AwgpuBindGroup;
}

/**
 * Synchronizes TransformCmp sets into GPU uniform buffers for Slot 3 instance binding.
 */
export class TransformSync {
    private readonly device: GPUDevice;
    private readonly layout: GPUBindGroupLayout;
    private readonly bindings = new Map<Entity, GpuTransformBinding>();

    constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
        this.device = device;
        this.layout = layout;
    }

    syncEntity(entity: Entity, transform: TransformCmp): GpuTransformBinding {
        let binding = this.bindings.get(entity);

        if (!binding) {
            transform.updateMatrix();
            const buffer = AwgpuBuffer.createUniform(
                this.device,
                transform.worldMatrix,
                `Transform_E${entity}_UBO`
            );
            const bindGroup = AwgpuBindGroup.create(
                this.device,
                this.layout,
                [{ binding: 0, resource: buffer }],
                { slot: AwgpuBindSlot.Instance, label: `Transform_E${entity}_BG` }
            );
            binding = { buffer, bindGroup };
            this.bindings.set(entity, binding);
            return binding;
        }

        if (transform.isDirty) {
            transform.updateMatrix();
            binding.buffer.write(this.device, transform.worldMatrix);
        }

        return binding;
    }

    syncSet(transforms: ComponentSet<TransformCmp>): void {
        for (const [entity, transform] of transforms) {
            this.syncEntity(entity, transform);
        }

        // Evict dead entities
        for (const entity of this.bindings.keys()) {
            if (!transforms.has(entity)) {
                const b = this.bindings.get(entity);
                b?.buffer.destroy();
                this.bindings.delete(entity);
            }
        }
    }

    getBinding(entity: Entity): GpuTransformBinding | undefined {
        return this.bindings.get(entity);
    }
}
