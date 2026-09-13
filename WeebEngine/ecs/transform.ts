import { Mat4, Vec3, Quat, DEG2RAD, type M16, type V3, type Q4 } from "../../Atoolkit/alm/index.js";
import { GpuTransform } from "../gpu/gtransform.js";

const scratchAxisX = new Float32Array([1, 0, 0]);
const scratchAxisY = new Float32Array([0, 1, 0]);
const scratchAxisZ = new Float32Array([0, 0, 1]);
const scratchRot = Quat();

/**
 * 3D Transform ECS Component.
 * Holds CPU TRS vectors and directly references GPU uniform transform handle.
 */
export class TransformCmp {
    position: V3;
    rotation: Q4;
    scale: V3;
    worldMatrix: M16;
    isDirty: boolean;
    readonly rTransform: GpuTransform;

    constructor(
        rTransform: GpuTransform,
        position?: ArrayLike<number>,
        rotation?: ArrayLike<number>,
        scale?: ArrayLike<number>
    ) {
        this.rTransform = rTransform;
        this.position = position ? Vec3(position) : Vec3(0, 0, 0);
        this.rotation = rotation ? Quat(rotation) : Quat.makeIdentity();
        this.scale = scale ? Vec3(scale) : Vec3(1, 1, 1);
        this.worldMatrix = Mat4();
        this.isDirty = true;
        this.updateMatrix();
    }

    updateMatrix(): this {
        Mat4.fromTRS(this.position, this.rotation, this.scale, this.worldMatrix);
        this.isDirty = false;
        return this;
    }

    setPosition(x: number, y: number, z: number): this {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = z;
        this.isDirty = true;
        return this;
    }

    setScale(x: number, y: number, z: number): this {
        this.scale[0] = x;
        this.scale[1] = y;
        this.scale[2] = z;
        this.isDirty = true;
        return this;
    }

    setUniformScale(s: number): this {
        this.scale[0] = s;
        this.scale[1] = s;
        this.scale[2] = s;
        this.isDirty = true;
        return this;
    }

    setRotationEuler(xDeg: number, yDeg: number, zDeg: number): this {
        Quat.fromEuler(xDeg * DEG2RAD, yDeg * DEG2RAD, zDeg * DEG2RAD, this.rotation);
        this.isDirty = true;
        return this;
    }

    rotateX(rad: number): this {
        Quat.fromAxisAngle(scratchAxisX, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }

    rotateY(rad: number): this {
        Quat.fromAxisAngle(scratchAxisY, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }

    rotateZ(rad: number): this {
        Quat.fromAxisAngle(scratchAxisZ, rad, scratchRot);
        Quat.mul(this.rotation, scratchRot, this.rotation);
        this.isDirty = true;
        return this;
    }
}
