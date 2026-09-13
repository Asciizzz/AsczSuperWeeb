import type { ComponentSet, Entity } from "../../Atoolkit/aecs/index.js";
import { AwgpuBuffer } from "../../Atoolkit/awgpu/index.js";
import type { SkinCmp } from "../components/skin.js";

/**
 * Synchronizes SkinCmp joint palettes into GPU storage buffers.
 */
export class SkinSync {
    private readonly device: GPUDevice;
    private readonly buffers = new Map<Entity, AwgpuBuffer>();

    constructor(device: GPUDevice) {
        this.device = device;
    }

    syncEntity(entity: Entity, skin: SkinCmp): AwgpuBuffer {
        let buffer = this.buffers.get(entity);

        if (!buffer) {
            buffer = AwgpuBuffer.createStorage(
                this.device,
                skin.jointPalette,
                { label: `Skin_E${entity}_SSBO`, readOnly: true }
            );
            this.buffers.set(entity, buffer);
            skin.isDirty = false;
            return buffer;
        }

        if (skin.isDirty) {
            buffer.write(this.device, skin.jointPalette);
            skin.isDirty = false;
        }

        return buffer;
    }

    syncSet(skins: ComponentSet<SkinCmp>): void {
        for (const [entity, skin] of skins) {
            this.syncEntity(entity, skin);
        }

        for (const entity of this.buffers.keys()) {
            if (!skins.has(entity)) {
                const b = this.buffers.get(entity);
                b?.destroy();
                this.buffers.delete(entity);
            }
        }
    }

    getBuffer(entity: Entity): AwgpuBuffer | undefined {
        return this.buffers.get(entity);
    }
}
