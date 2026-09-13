import { Mat4, type M16 } from "../../Atoolkit/alm/index.js";
import type { ComponentSet } from "../../Atoolkit/aecs/index.js";
import type { SkinCmp } from "../ecs/skincmp.js";
import type { WeebWorld } from "../ecs/world.js";

const scratchLocal = Mat4();
const scratchWorldJoints: M16[] = [];

function ensureScratchCapacity(capacity: number): void {
    while (scratchWorldJoints.length < capacity) {
        scratchWorldJoints.push(Mat4());
    }
}

/**
 * System that evaluates joint matrices in topological order and writes
 * (worldJoint * invBind) directly into the GPU joint palette storage buffer.
 */
export class SkinSystem {
    static update(
        worldOrSkins: WeebWorld | ComponentSet<SkinCmp>,
        device: GPUDevice
    ): void {
        const set = "skins" in worldOrSkins ? worldOrSkins.skins : worldOrSkins;
        const dense = set.dense;
        const len = dense.length;

        for (let i = 0; i < len; i++) {
            const skin = dense[i];
            if (!skin.isDirty) continue;

            const joints = skin.rSkeleton.joints;
            const count = joints.length;
            if (count === 0) {
                skin.isDirty = false;
                continue;
            }

            ensureScratchCapacity(count);
            const computed = new Uint8Array(count);

            const computeWorld = (idx: number): void => {
                if (computed[idx]) return;
                const joint = joints[idx];
                const pose = skin.localPoses[idx] ?? joint.localTransform;

                Mat4.fromTRS(
                    pose.position,
                    pose.rotation,
                    pose.scale,
                    scratchLocal
                );

                if (joint.parentIndex >= 0 && joint.parentIndex < count && joint.parentIndex !== idx) {
                    computeWorld(joint.parentIndex);
                    Mat4.mul(scratchWorldJoints[joint.parentIndex], scratchLocal, scratchWorldJoints[idx]);
                } else {
                    Mat4.copy(scratchLocal, scratchWorldJoints[idx]);
                }

                computed[idx] = 1;
            };

            for (let j = 0; j < count; j++) {
                computeWorld(j);
                const offset = j * 16;
                const targetSlice = skin.rSkin.jointPalette.subarray(offset, offset + 16);
                Mat4.mul(scratchWorldJoints[j], joints[j].invBindMatrix, targetSlice);
            }

            skin.rSkin.update(device);
            skin.isDirty = false;
        }
    }
}
