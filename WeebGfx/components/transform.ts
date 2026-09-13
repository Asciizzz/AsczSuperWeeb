import {
    Vec3,
    Quat,
    Mat4,
    type V3,
    type Q4,
    type M16,
} from "../../Atoolkit/alm/index.js";

/**
 * Pure data spatial transform component.
 * Free of GPU handles; coordinates TRS vectors and cached world matrix.
 */
export class TransformCmp {
    readonly position: V3;
    readonly rotation: Q4;
    readonly scale: V3;
    readonly worldMatrix: M16;
    isDirty: boolean;

    constructor(
        position: [number, number, number] = [0, 0, 0],
        rotation: [number, number, number, number] = [0, 0, 0, 1],
        scale: [number, number, number] = [1, 1, 1]
    ) {
        this.position = Vec3(position[0], position[1], position[2]);
        this.rotation = Quat();
        this.rotation.set(rotation);
        this.scale = Vec3(scale[0], scale[1], scale[2]);
        this.worldMatrix = Mat4();
        this.isDirty = true;
        this.updateMatrix();
    }

    setPosition(x: number, y: number, z = 0): this {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = z;
        this.isDirty = true;
        return this;
    }

    setScale(x: number, y: number, z = 1): this {
        this.scale[0] = x;
        this.scale[1] = y;
        this.scale[2] = z;
        this.isDirty = true;
        return this;
    }

    setRotationAxisAngle(axis: V3, rad: number): this {
        Quat.fromAxisAngle(axis, rad, this.rotation);
        this.isDirty = true;
        return this;
    }

    updateMatrix(): boolean {
        if (!this.isDirty) return false;
        Mat4.fromTRS(this.position, this.rotation, this.scale, this.worldMatrix);
        this.isDirty = false;
        return true;
    }
}
