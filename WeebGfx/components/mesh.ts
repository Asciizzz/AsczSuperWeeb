import type { Mesh } from "../assets/mesh.js";

/**
 * Pure data mesh binding component.
 * Attaches geometry asset reference and visibility flags to entity.
 */
export class MeshCmp {
    mesh: Mesh;
    visible: boolean;
    submeshMask?: number;

    constructor(mesh: Mesh, visible = true, submeshMask?: number) {
        this.mesh = mesh;
        this.visible = visible;
        this.submeshMask = submeshMask;
    }
}
