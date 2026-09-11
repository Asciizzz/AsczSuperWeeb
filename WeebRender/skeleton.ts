import { type Aecs } from "../Atoolkit/aecs/index.js";
import { Mat4, Vec3, Quat, type M16, type V3, type Q4 } from "../Atoolkit/alm/index.js";

// ==================== Interfaces & Classes ====================

export interface Joint {
    name: string;
    parentIndex: number; // -1 for root joint in bone rig
    invBindMatrix: M16;  // Inverse bind pose matrix (Mat4)
    localTransform: {
        position: V3;
        rotation: Q4;
        scale: V3;
    };
}

/**
 * Static Skeleton asset definition.
 */
export class Skeleton {
    name: string;
    joints: Joint[];

    constructor(name = "Skeleton", joints: Joint[] = []) {
        this.name = name;
        this.joints = joints;
    }
}

export interface JointPose {
    position: V3;
    rotation: Q4;
    scale: V3;
}

// ==================== ECS Skin Component ====================

/**
 * Dynamic animated joint palette matrices for GPU skinning.
 * Maintains entity-specific local joint poses to preserve static Skeleton immutability.
 */
export class SkinCmp {
    rSkeleton: Skeleton;
    jointPalette: Float32Array; // Flattened array of (jointCount * 16) floats
    localPoses: JointPose[];    // Per-entity local joint poses
    isDirty: boolean;

    constructor(skeleton: Skeleton) {
        this.rSkeleton = skeleton;
        this.jointPalette = new Float32Array(Math.max(1, skeleton.joints.length) * 16);
        this.localPoses = skeleton.joints.map((j) => ({
            position: Vec3(j.localTransform.position),
            rotation: Quat(j.localTransform.rotation),
            scale: Vec3(j.localTransform.scale),
        }));
        this.isDirty = true;
    }

    /**
     * Updates a specific joint's runtime local pose for this entity without mutating the shared Skeleton asset.
     */
    setJointPose(
        jointIndex: number,
        pos?: ArrayLike<number>,
        rot?: ArrayLike<number>,
        scale?: ArrayLike<number>
    ): void {
        const pose = this.localPoses[jointIndex];
        if (!pose) return;

        if (pos) Vec3.copy(pos as V3, pose.position);
        if (rot) Quat.copy(rot as Q4, pose.rotation);
        if (scale) Vec3.copy(scale as V3, pose.scale);
        this.isDirty = true;
    }

    /**
     * Resets this entity's joint poses back to the skeleton's bind pose.
     */
    resetToBindPose(): void {
        const joints = this.rSkeleton.joints;
        for (let i = 0; i < joints.length; i++) {
            const j = joints[i];
            const p = this.localPoses[i];
            if (p) {
                Vec3.copy(j.localTransform.position, p.position);
                Quat.copy(j.localTransform.rotation, p.rotation);
                Vec3.copy(j.localTransform.scale, p.scale);
            }
        }
        this.isDirty = true;
    }
}

// ==================== Skinning System ====================

// Reusable scratch matrices to guarantee zero GC allocations during animation updates
const scratchLocal = Mat4();
const scratchWorldJoints: M16[] = [];

function ensureScratchCapacity(capacity: number): void {
    while (scratchWorldJoints.length < capacity) {
        scratchWorldJoints.push(Mat4());
    }
}

/**
 * System that evaluates joint matrices in topological order and writes
 * (worldJoint * invBind) directly into the entity's jointPalette buffer.
 */
export function updateSkinSystem(ecs: Aecs): void {
    for (const [_, skin] of ecs.query(SkinCmp)) {
        if (!skin.isDirty) continue;

        const joints = skin.rSkeleton.joints;
        const count = joints.length;
        if (count === 0) {
            skin.isDirty = false;
            continue;
        }

        ensureScratchCapacity(count);

        // Track which joint world matrices have been computed
        const computed = new Uint8Array(count);

        const computeWorld = (idx: number): void => {
            if (computed[idx]) return;
            const joint = joints[idx];
            const pose = skin.localPoses[idx] ?? joint.localTransform;

            // 1. Compute local TRS matrix from entity's pose
            Mat4.fromTRS(
                pose.position,
                pose.rotation,
                pose.scale,
                scratchLocal
            );

            // 2. Accumulate parent transform (evaluate parent first if not already computed)
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
            // 3. Compute final skinning matrix: final = worldJoint * invBindMatrix
            const offset = j * 16;
            const targetSlice = skin.jointPalette.subarray(offset, offset + 16);
            Mat4.mul(scratchWorldJoints[j], joints[j].invBindMatrix, targetSlice);
        }

        skin.isDirty = false;
    }
}
