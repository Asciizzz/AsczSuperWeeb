import { Vec3, Quat, type V3, type Q4 } from "../../Atoolkit/alm/index.js";
import { Skeleton, type JointPose } from "../assets/skeleton.js";
import { GpuSkin } from "../gpu/gskin.js";

/**
 * Skinning ECS Component.
 * Holds CPU joint hierarchy asset, runtime local joint poses, and direct reference to GPU joint palette buffer.
 */
export class SkinCmp {
    readonly rSkeleton: Skeleton;
    readonly rSkin: GpuSkin;
    readonly localPoses: JointPose[];
    isDirty: boolean;

    constructor(rSkeleton: Skeleton, rSkin: GpuSkin) {
        this.rSkeleton = rSkeleton;
        this.rSkin = rSkin;
        this.localPoses = rSkeleton.createDefaultPoses();
        this.isDirty = true;
    }

    setJointPose(
        jointIndex: number,
        pos?: ArrayLike<number>,
        rot?: ArrayLike<number>,
        scale?: ArrayLike<number>
    ): this {
        const pose = this.localPoses[jointIndex];
        if (!pose) return this;

        if (pos) Vec3.copy(pos as V3, pose.position);
        if (rot) Quat.copy(rot as Q4, pose.rotation);
        if (scale) Vec3.copy(scale as V3, pose.scale);
        this.isDirty = true;
        return this;
    }

    resetToBindPose(): this {
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
        return this;
    }
}
