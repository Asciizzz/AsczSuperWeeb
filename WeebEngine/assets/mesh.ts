export interface Submesh {
    name: string;
    indexStart: number;
    indexCount: number;
    shaderSlot?: number;
    visible?: boolean;
}

export interface VertexAttribute {
    name: "POSITION" | "NORMAL" | "TANGENT" | "TEXCOORD_0" | "JOINTS_0" | "WEIGHTS_0" | string;
    format: "float32x3" | "float32x2" | "float32x4" | "uint16x4" | "uint32x4";
    offset: number;
    shaderLocation: number;
}

let nextMeshId = 0;

/**
 * Pure CPU Mesh asset container.
 * Stores geometry data independent of any GPU device or execution context.
 */
export class Mesh {
    readonly id: number;
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
        this.id = ++nextMeshId;
        this.name = name;
        this.vertices = vertices;
        this.indices = indices;
        this.submeshes = submeshes.length > 0 ? submeshes : [
            { name: "default", indexStart: 0, indexCount: indices.length, shaderSlot: 0 }
        ];
        this.stride = stride;
        this.attributes = attributes;
    }

    get vertexCount(): number {
        return this.stride > 0 ? (this.vertices.byteLength / this.stride) : 0;
    }

    get indexCount(): number {
        return this.indices.length;
    }
}
