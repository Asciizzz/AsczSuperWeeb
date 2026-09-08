import { Acmp } from "../Atoolkit/acmp/index.js";
import type { GpuMesh } from "./gpu.js";

// ==================== Interfaces ====================

export interface Submesh {
    name: string;
    indexStart: number;
    indexCount: number;
    shaderSlot?: number;
    visible?: boolean;
    localAABB?: { min: Float32Array; max: Float32Array };
}

export interface VertexAttribute {
    name: "POSITION" | "NORMAL" | "TANGENT" | "TEXCOORD_0" | "JOINTS_0" | "WEIGHTS_0" | string;
    format: "float32x3" | "float32x2" | "float32x4" | "uint16x4" | "uint32x4";
    offset: number;
    shaderLocation: number;
}

let meshIdCounter = 0;

/**
 * Pure CPU Mesh asset data container.
 * Completely backend-agnostic: holds raw vertices, indices, submeshes, and attribute definitions.
 */
export class Mesh {
    id: number;
    name: string;
    vertices: Float32Array;
    indices: Uint16Array | Uint32Array;
    submeshes: Submesh[];
    stride: number;
    attributes: VertexAttribute[];

    constructor(
        name = "Mesh",
        vertices: Float32Array = new Float32Array(0),
        indices: Uint16Array | Uint32Array = new Uint16Array(0),
        submeshes: Submesh[] = [],
        stride = 32,
        attributes: VertexAttribute[] = []
    ) {
        this.id = ++meshIdCounter;
        this.name = name;
        this.vertices = vertices;
        this.indices = indices;
        this.submeshes = submeshes;
        this.stride = stride;
        this.attributes = attributes;
    }

    get vertexCount(): number {
        return this.stride > 0 ? (this.vertices.byteLength / this.stride) : 0;
    }
}

// ==================== ECS Component ====================

/**
 * Mesh component holding a reference to a GPU-resident GpuMesh.
 */
export class MeshCmp extends Acmp {
    rMesh: GpuMesh;
    visible: boolean;

    constructor(mesh: GpuMesh, visible = true) {
        super();
        this.rMesh = mesh;
        this.visible = visible;
    }
}
