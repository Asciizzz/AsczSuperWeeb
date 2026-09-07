import { Acmp } from "../Atoolkit/acmp/index.js";

// ==================== Interfaces ====================

export interface Submesh {
    name: string;
    indexStart: number;
    indexCount: number;
    materialSlot?: number;
    rShader?: any;
    visible?: boolean;
    localAABB?: { min: Float32Array; max: Float32Array };
}

export interface VertexAttribute {
    name: "POSITION" | "NORMAL" | "TANGENT" | "TEXCOORD_0" | "JOINTS_0" | "WEIGHTS_0" | string;
    format: "float32x3" | "float32x2" | "float32x4" | "uint16x4" | "uint32x4";
    offset: number;
    shaderLocation: number;
}

/**
 * Creates a WebGPU vertex buffer layout from stride and attributes.
 */
export function createVertexBufferLayout(
    stride: number,
    attributes: VertexAttribute[]
): GPUVertexBufferLayout {
    return {
        arrayStride: stride,
        stepMode: "vertex",
        attributes: attributes.map((attr) => ({
            format: attr.format,
            offset: attr.offset,
            shaderLocation: attr.shaderLocation,
        })),
    };
}

let meshIdCounter = 0;

/**
 * Static Mesh asset data.
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
 * Mesh component holding a reference to a static Mesh asset.
 */
export class MeshCmp extends Acmp {
    rMesh: Mesh;
    visible: boolean;

    constructor(mesh: Mesh, visible = true) {
        super();
        this.rMesh = mesh;
        this.visible = visible;
    }
}
