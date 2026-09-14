import type { VertexLayout, Submesh } from "./types.js";

/**
 * Pure CPU geometry resource holding raw binary data and vertex layout.
 * Enforces zero encapsulation: attributes are directly accessible.
 */
export class MeshCPU {
    layout: VertexLayout;
    submeshes: Submesh[];
    vertexBytes: ArrayBuffer;
    indexBytes?: Uint16Array | Uint32Array;

    constructor(
        layout: VertexLayout,
        submeshes: Submesh[],
        vertexBytes: ArrayBuffer,
        indexBytes?: Uint16Array | Uint32Array
    ) {
        if (!submeshes || submeshes.length === 0) {
            throw new Error("[MeshCPU] Mesh must contain at least 1 submesh.");
        }
        this.layout = layout;
        this.submeshes = submeshes;
        this.vertexBytes = vertexBytes;
        this.indexBytes = indexBytes;
    }
}

/**
 * Base inheritable GPU geometry resource.
 * Decoupled from any specific graphics API. Subclasses hold native GPU buffers.
 */
export class MeshGPU {
    cpu: MeshCPU;
    submeshes: Submesh[];

    constructor(cpu: MeshCPU, submeshes?: Submesh[]) {
        this.cpu = cpu;
        this.submeshes = submeshes ?? cpu.submeshes;
    }

    destroy(): void {
        // Base hook for hardware buffer disposal
    }
}
