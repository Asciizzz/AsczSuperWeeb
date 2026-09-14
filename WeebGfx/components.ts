import type { MeshGPU } from "./mesh.js";
import type { ShaderGPU } from "./shader.js";
import type { ShaderParams } from "./types.js";
import type { Camera } from "./camera.js";

/**
 * Live mesh component pointing to an inheritable base MeshGPU resource.
 */
export class MeshCmp {
    mesh: MeshGPU;
    visible: boolean;

    constructor(mesh: MeshGPU, visible = true) {
        this.mesh = mesh;
        this.visible = visible;
    }
}

/**
 * Live shader component mapping N base ShaderGPU slots to N submeshes of the entity's mesh.
 */
export class ShaderCmp {
    shaders: (ShaderGPU | null)[];
    params: ShaderParams[];

    constructor(
        shaders: (ShaderGPU | null)[] = [],
        params: ShaderParams[] = []
    ) {
        this.shaders = shaders;
        this.params = params;
    }

    /**
     * Sets the shader and parameter bag for a specific submesh index.
     */
    setSubmesh(index: number, shader: ShaderGPU | null, params: ShaderParams = {}): this {
        this.shaders[index] = shader;
        this.params[index] = params;
        return this;
    }
}

/**
 * Live transform component storing world and optional normal matrices.
 */
export class TransformCmp {
    worldMatrix: Float32Array;
    normalMatrix?: Float32Array;

    constructor(worldMatrix?: Float32Array, normalMatrix?: Float32Array) {
        this.worldMatrix = worldMatrix ?? new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
        this.normalMatrix = normalMatrix;
    }
}

/**
 * Live skinning component holding bone joint matrices.
 */
export class SkinCmp {
    jointMatrices: Float32Array;
    jointCount: number;

    constructor(jointMatrices: Float32Array, jointCount: number) {
        this.jointMatrices = jointMatrices;
        this.jointCount = jointCount;
    }
}

/**
 * Live camera component holding a Camera resource.
 */
export class CameraCmp {
    camera: Camera;
    active: boolean;

    constructor(camera: Camera, active = true) {
        this.camera = camera;
        this.active = active;
    }
}

