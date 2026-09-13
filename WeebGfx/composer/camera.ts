import {
    Mat4,
    Vec3,
    DEG2RAD,
    type M16,
    type V3,
} from "../../Atoolkit/alm/index.js";
import {
    AwgpuBuffer,
    AwgpuBindGroup,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindSlot,
} from "../../Atoolkit/awgpu/index.js";

export type CameraProjection = "perspective" | "orthographic";

/**
 * Universal camera coordinating view-projection matrices, time, and resolution uniforms.
 */
export class GfxCamera {
    projection: CameraProjection = "perspective";
    fov = 55.0;
    near = 0.1;
    far = 1000.0;
    orthoSize = 5.0;

    readonly position: V3 = Vec3(0, 2, 8);
    readonly target: V3 = Vec3(0, 0, 0);
    readonly up: V3 = Vec3(0, 1, 0);

    readonly viewMatrix: M16 = Mat4();
    readonly projMatrix: M16 = Mat4();
    readonly viewProj: M16 = Mat4();

    // 32 floats = 128 bytes
    // 0..15: viewProj (64 bytes)
    // 16..19: cameraPos.xyz + pad (16 bytes)
    // 20..23: time, beatPulse, aspect, tempo (16 bytes)
    // 24..27: screenRes.xy, pad, pad (16 bytes)
    // 28..31: reserved (16 bytes)
    readonly uniformData = new Float32Array(32);
    readonly uniformBuffer: AwgpuBuffer;
    readonly bindGroup: AwgpuBindGroup;

    constructor(device: GPUDevice, projection: CameraProjection = "perspective") {
        this.projection = projection;
        this.uniformBuffer = AwgpuBuffer.createUniform(device, this.uniformData, "GfxCameraUBO");

        const layout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)
            .build(device, "GfxCameraLayout");

        this.bindGroup = AwgpuBindGroup.create(
            device,
            layout,
            [{ binding: 0, resource: this.uniformBuffer }],
            { slot: AwgpuBindSlot.Pass, label: "GfxCameraBG" }
        );
    }

    lookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number] = [0, 1, 0]): this {
        this.position[0] = eye[0];
        this.position[1] = eye[1];
        this.position[2] = eye[2];
        this.target[0] = target[0];
        this.target[1] = target[1];
        this.target[2] = target[2];
        this.up[0] = up[0];
        this.up[1] = up[1];
        this.up[2] = up[2];
        return this;
    }

    update(
        device: GPUDevice,
        aspect: number,
        time = 0.0,
        beatPulse = 0.0,
        width = 1920,
        height = 1080
    ): void {
        Mat4.lookAt(this.position, this.target, this.up, this.viewMatrix);

        if (this.projection === "perspective") {
            Mat4.perspective(this.fov * DEG2RAD, aspect, this.near, this.far, this.projMatrix);
        } else {
            const h = this.orthoSize;
            const w = h * aspect;
            Mat4.orthoZO(-w, w, -h, h, this.near, this.far, this.projMatrix);
        }

        Mat4.mul(this.projMatrix, this.viewMatrix, this.viewProj);

        // Pack 32 floats (128 bytes)
        this.uniformData.set(this.viewProj, 0);

        this.uniformData[16] = this.position[0];
        this.uniformData[17] = this.position[1];
        this.uniformData[18] = this.position[2];
        this.uniformData[19] = 1.0;

        this.uniformData[20] = time;
        this.uniformData[21] = beatPulse;
        this.uniformData[22] = aspect;
        this.uniformData[23] = 120.0;

        this.uniformData[24] = width;
        this.uniformData[25] = height;
        this.uniformData[26] = 0.0;
        this.uniformData[27] = 0.0;

        this.uniformBuffer.write(device, this.uniformData);
    }
}
