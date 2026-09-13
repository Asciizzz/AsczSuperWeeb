import { GpuMesh } from "../gpu/gmesh.js";

/**
 * Mesh ECS Component.
 * Holds direct reference to GPU geometry handle.
 */
export class MeshCmp {
    readonly rMesh: GpuMesh;
    visible: boolean;
    submeshMask?: number;

    constructor(rMesh: GpuMesh, visible = true, submeshMask?: number) {
        this.rMesh = rMesh;
        this.visible = visible;
        this.submeshMask = submeshMask;
    }
}
