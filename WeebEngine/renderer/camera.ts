import {
    Mat4,
    Vec3,
    DEG2RAD,
    type M16,
    type V3,
} from "../../Atoolkit/alm/index.js";
import {
    AwgpuBuffer,
    AwgpuBindSlot,
    AwgpuBindGroup,
} from "../../Atoolkit/awgpu/index.js";
import { getCommonLayouts } from "../gpu/gshader.js";

/**
 * Camera managing projection, view matrices, eye position, and slot 0 Pass bind group.
 */
export class Camera {
    fov: number;
    aspect: number;
    near: number;
    far: number;

    position: V3;
    target: V3;
    up: V3;

    viewMatrix: M16;
    projMatrix: M16;
    viewProj: M16;

    readonly uniformBuffer: AwgpuBuffer;
    readonly uniformData = new Float32Array(20);
    bindGroup: AwgpuBindGroup;
    isDirty = true;

    constructor(
        device: GPUDevice,
        fov = 60,
        aspect = 1,
        near = 0.1,
        far = 1000
    ) {
        this.fov = fov;
        this.aspect = aspect;
        this.near = near;
        this.far = far;

        this.position = Vec3(0, 2, 5);
        this.target = Vec3(0, 0, 0);
        this.up = Vec3(0, 1, 0);

        this.viewMatrix = Mat4();
        this.projMatrix = Mat4();
        this.viewProj = Mat4();

        this.uniformBuffer = AwgpuBuffer.createUniform(device, this.uniformData, "CameraUniformBuffer");

        const { cameraLayout } = getCommonLayouts(device);
        this.bindGroup = AwgpuBindGroup.create(
            device,
            cameraLayout,
            [{ binding: 0, resource: this.uniformBuffer }],
            { slot: AwgpuBindSlot.Pass, label: "CameraPassBG" }
        );

        this.updateMatrices();
        this.syncBuffer(device);
    }

    lookAt(eye: ArrayLike<number>, target: ArrayLike<number>, up: ArrayLike<number> = [0, 1, 0]): this {
        Vec3.copy(eye as V3, this.position);
        Vec3.copy(target as V3, this.target);
        Vec3.copy(up as V3, this.up);
        this.isDirty = true;
        return this;
    }

    setPerspective(fov: number, aspect: number, near?: number, far?: number): this {
        this.fov = fov;
        this.aspect = aspect;
        if (near !== undefined) this.near = near;
        if (far !== undefined) this.far = far;
        this.isDirty = true;
        return this;
    }

    updateMatrices(): void {
        Mat4.perspective(this.fov * DEG2RAD, this.aspect, this.near, this.far, this.projMatrix);
        Mat4.lookAt(this.position, this.target, this.up, this.viewMatrix);
        Mat4.mul(this.projMatrix, this.viewMatrix, this.viewProj);

        this.uniformData.set(this.viewProj, 0);
        this.uniformData[16] = this.position[0];
        this.uniformData[17] = this.position[1];
        this.uniformData[18] = this.position[2];
        this.uniformData[19] = 1.0;

        this.isDirty = false;
    }

    syncBuffer(device: GPUDevice): void {
        if (this.isDirty) {
            this.updateMatrices();
        }
        this.uniformBuffer.write(device, this.uniformData);
    }

    destroy(): void {
        this.uniformBuffer.destroy();
    }
}
