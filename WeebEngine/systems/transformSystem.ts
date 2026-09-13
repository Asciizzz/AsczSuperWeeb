import type { ComponentSet } from "../../Atoolkit/aecs/index.js";
import type { TransformCmp } from "../ecs/transform.js";
import type { WeebWorld } from "../ecs/world.js";

/**
 * System that evaluates TRS matrices for dirty transforms and uploads
 * the updated 64-byte model matrix directly to the GPU buffer.
 * High performance, zero GC allocations, flat contiguous iteration.
 */
export class TransformSystem {
    static update(
        worldOrTransforms: WeebWorld | ComponentSet<TransformCmp>,
        device: GPUDevice
    ): void {
        const set = "transforms" in worldOrTransforms ? worldOrTransforms.transforms : worldOrTransforms;
        const dense = set.dense;
        const len = dense.length;

        for (let i = 0; i < len; i++) {
            const transform = dense[i];
            if (transform.isDirty) {
                transform.updateMatrix();
                transform.rTransform.update(device, transform.worldMatrix);
            }
        }
    }
}
