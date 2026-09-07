import { Acmp } from "../Atoolkit/acmp/index.js";
import { Mat4, Vec3, DEG2RAD, type M16, type V3 } from "../Atoolkit/alm/index.js";
import type { TransformCmp } from "./transform.js";

const DEFAULT_UP: V3 = Vec3(0, 1, 0);

/**
 * Camera ECS component.
 * Stores projection properties, view matrix, and precomputed view-projection matrix.
 */
export class CameraCmp extends Acmp {
    fov: number;             // Vertical FOV in degrees
    aspect: number;          // Viewport aspect ratio (width / height)
    near: number;            // Near clipping plane
    far: number;             // Far clipping plane
    isOrthographic: boolean; // Perspective or orthographic
    orthoSize: number;       // Half-height for orthographic view

    viewMatrix: M16;
    projMatrix: M16;
    viewProjMatrix: M16;
    eyePos: V3;

    constructor(
        fov = 60,
        aspect = 16 / 9,
        near = 0.1,
        far = 1000,
        isOrthographic = false,
        orthoSize = 5
    ) {
        super();
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;
        this.isOrthographic = isOrthographic;
        this.orthoSize = orthoSize;

        this.viewMatrix = Mat4.makeIdentity();
        this.projMatrix = Mat4.makeIdentity();
        this.viewProjMatrix = Mat4.makeIdentity();
        this.eyePos = Vec3(0, 0, 0);

        this.updateProjection(true);
    }

    /**
     * Updates projection matrix and precomputes viewProjMatrix.
     * @param isWebGpu When true, uses zero-to-one [0, 1] clip depth (WebGPU). When false, uses [-1, 1] (WebGL2).
     */
    updateProjection(isWebGpu = true): this {
        if (this.isOrthographic) {
            const h = this.orthoSize;
            const w = h * this.aspect;
            if (isWebGpu) {
                Mat4.orthoZO(-w, w, -h, h, this.near, this.far, this.projMatrix);
            } else {
                Mat4.orthoNO(-w, w, -h, h, this.near, this.far, this.projMatrix);
            }
        } else {
            const fovRad = this.fov * DEG2RAD;
            if (isWebGpu) {
                Mat4.perspectiveZO(fovRad, this.aspect, this.near, this.far, this.projMatrix);
            } else {
                Mat4.perspectiveNO(fovRad, this.aspect, this.near, this.far, this.projMatrix);
            }
        }
        Mat4.mul(this.projMatrix, this.viewMatrix, this.viewProjMatrix);
        return this;
    }

    /**
     * Updates view matrix using camera eye position and target look-at point.
     */
    lookAt(eye: V3 | ArrayLike<number>, target: V3 | ArrayLike<number>, up: V3 | ArrayLike<number> = DEFAULT_UP): this {
        const eyeV: V3 = (eye instanceof Float32Array && eye.length === 3) ? (eye as V3) : Vec3(eye);
        const targetV: V3 = (target instanceof Float32Array && target.length === 3) ? (target as V3) : Vec3(target);
        const upV: V3 = (up instanceof Float32Array && up.length === 3) ? (up as V3) : Vec3(up);
        Mat4.lookAt(eyeV, targetV, upV, this.viewMatrix);
        Vec3.copy(eyeV, this.eyePos);
        Mat4.mul(this.projMatrix, this.viewMatrix, this.viewProjMatrix);
        return this;
    }

    /**
     * Computes view matrix from an entity's TransformCmp by inverting its world matrix.
     */
    updateFromTransform(transform: TransformCmp): this {
        if (transform.isDirty) {
            transform.updateMatrix();
        }
        Mat4.invert(transform.worldMatrix, this.viewMatrix);
        Vec3.copy(transform.position, this.eyePos);
        Mat4.mul(this.projMatrix, this.viewMatrix, this.viewProjMatrix);
        return this;
    }
}
