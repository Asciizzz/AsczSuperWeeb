import { ComponentSet } from "../Atoolkit/aecs/index.js";
import { Mat4, Vec3, Quat, DEG2RAD, type M16, type V3, type Q4 } from "../Atoolkit/alm/index.js";

// Reusable scratch variables for rotation calculations (zero garbage collection)
const scratchAxisX = new Float32Array([1, 0, 0]);
const scratchAxisY = new Float32Array([0, 1, 0]);
const scratchAxisZ = new Float32Array([0, 0, 1]);
const scratchRot = Quat();

/**
 * 3D Transform ECS Component.
 */
export class TransformCmp {
    position: V3;
    rotation: Q4;
    scale: V3;
    worldMatrix: M16;
    isDirty: boolean;

    constructor(
        position?: ArrayLike<number>,
        rotation?: ArrayLike<number>,
        scale?: ArrayLike<number>
    ) {
        this.position = position ? Vec3(position) : Vec3(0, 0, 0);
        this.rotation = rotation ? Quat(rotation) : Quat.makeIdentity();
        this.scale = scale ? Vec3(scale) : Vec3(1, 1, 1);
        this.worldMatrix = Mat4();
        this.isDirty = true;

        this.updateMatrix();
    }

    /**
     * Updates worldMatrix from TRS components using Alm.fromTRS.
     */
    updateMatrix(): this {
        Mat4.fromTRS(this.position, this.rotation, this.scale, this.worldMatrix);
        this.isDirty = false;
        return this;
    }

    /**
     * Sets position and marks transform dirty.
     */
    setPosition(x: number, y: number, z: number): this {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = z;
        this.isDirty = true;
        return this;
    }

    /**
     * Sets scale and marks transform dirty.
     */
    setScale(x: number, y: number, z: number): this {
        this.scale[0] = x;
        this.scale[1] = y;
        this.scale[2] = z;
        this.isDirty = true;
        return this;
    }

    /**
     * Sets uniform scale.
     */
    setUniformScale(s: number): this {
        this.scale[0] = s;
        this.scale[1] = s;
        this.scale[2] = s;
        this.isDirty = true;
        return this;
    }

    /**
     * Sets rotation from Euler angles in degrees (Yaw Pitch Roll).
     */
    setRotationEuler(xDeg: number, yDeg: number, zDeg: number): this {
        Quat.fromEuler(xDeg * DEG2RAD, yDeg * DEG2RAD, zDeg * DEG2RAD, this.rotation);
        this.isDirty = true;
        return this;
    }

    /**
     * Rotates around X axis by radians and marks transform dirty.
     */
    rotateX(rad: number): this {
        Quat.fromAxisAngle(scratchAxisX, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }

    /**
     * Rotates around Y axis by radians and marks transform dirty.
     */
    rotateY(rad: number): this {
        Quat.fromAxisAngle(scratchAxisY, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }

    /**
     * Rotates around Z axis by radians and marks transform dirty.
     */
    rotateZ(rad: number): this {
        Quat.fromAxisAngle(scratchAxisZ, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }
}

/**
 * System that updates world matrices for all dirty TransformCmp entities in flat order.
 * High-performance, zero recursion, zero hierarchy.
 */
export function updateTransformSystem(transforms: ComponentSet<TransformCmp> | { transforms: ComponentSet<TransformCmp> }): void {
    const set = "transforms" in transforms ? transforms.transforms : transforms;
    const len = set.dense.length;
    for (let i = 0; i < len; i++) {
        const transform = set.dense[i];
        if (transform.isDirty) {
            transform.updateMatrix();
        }
    }
}
