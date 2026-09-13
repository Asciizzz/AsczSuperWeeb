import { Mat4, Vec3, Quat, type M16, type V3, type Q4 } from "../../Atoolkit/alm/index.js";

export interface Joint {
    name: string;
    parentIndex: number;
    invBindMatrix: M16;
    localTransform: {
        position: V3;
        rotation: Q4;
        scale: V3;
    };
}

export interface JointPose {
    position: V3;
    rotation: Q4;
    scale: V3;
}

let nextSkeletonId = 0;

/**
 * Pure CPU Skeleton asset container.
 * Stores joint hierarchy and inverse bind pose matrices.
 */
export class Skeleton {
    readonly id: number;
    name: string;
    joints: Joint[];

    constructor(name = "Skeleton", joints: Joint[] = []) {
        this.id = ++nextSkeletonId;
        this.name = name;
        this.joints = joints;
    }

    createDefaultPoses(): JointPose[] {
        return this.joints.map((j) => ({
            position: Vec3(j.localTransform.position),
            rotation: Quat(j.localTransform.rotation),
            scale: Vec3(j.localTransform.scale),
        }));
    }
}
