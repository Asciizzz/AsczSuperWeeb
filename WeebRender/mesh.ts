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

    // GPU-resident resources
    vertexBuffer: GPUBuffer | null = null;
    indexBuffer: GPUBuffer | null = null;
    indexFormat: GPUIndexFormat = "uint16";
    indexCount = 0;
    gpuOwned = false;

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
        this.indexCount = indices.length;
        this.indexFormat = indices instanceof Uint32Array ? "uint32" : "uint16";
    }

    get vertexCount(): number {
        return this.stride > 0 ? (this.vertices.byteLength / this.stride) : 0;
    }

    /**
     * Allocates GPU vertex and index buffers and uploads CPU vertex data.
     * Marks the GPU resources as owned by this Mesh instance.
     */
    gpuCreate(device: GPUDevice): this {
        if (this.vertexBuffer && this.indexBuffer && this.gpuOwned) {
            return this;
        }

        const size = Math.max(32, this.vertices.byteLength);
        this.vertexBuffer = device.createBuffer({
            label: `MeshVertex_${this.name}_${this.id}`,
            size,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        if (this.vertices.byteLength > 0) {
            device.queue.writeBuffer(
                this.vertexBuffer,
                0,
                this.vertices.buffer as ArrayBuffer,
                this.vertices.byteOffset,
                this.vertices.byteLength
            );
        }

        const is32Bit = this.indices instanceof Uint32Array;
        const iSize = Math.max(4, this.indices.byteLength);
        this.indexBuffer = device.createBuffer({
            label: `MeshIndex_${this.name}_${this.id}`,
            size: iSize,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        if (this.indices.byteLength > 0) {
            device.queue.writeBuffer(
                this.indexBuffer,
                0,
                this.indices.buffer as ArrayBuffer,
                this.indices.byteOffset,
                this.indices.byteLength
            );
        }

        this.indexFormat = is32Bit ? "uint32" : "uint16";
        this.indexCount = this.indices.length;
        this.gpuOwned = true;
        return this;
    }

    /**
     * Attaches external GPU vertex and index buffers without taking ownership.
     * Ideal for compute-shader-generated meshes, dynamic particle buffers, or procedural geometry.
     */
    ref(
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        options: { indexFormat?: GPUIndexFormat; indexCount?: number } = {}
    ): this {
        if (this.gpuOwned) {
            this.destroy();
        }
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.indexFormat = options.indexFormat ?? (this.indices instanceof Uint32Array ? "uint32" : "uint16");
        this.indexCount = options.indexCount ?? this.indices.length;
        this.gpuOwned = false;
        return this;
    }

    /**
     * Re-uploads CPU vertex and index data to existing GPU buffers.
     */
    updateGpu(device: GPUDevice): void {
        if (!this.vertexBuffer || !this.indexBuffer) return;
        if (this.vertices.byteLength > 0) {
            device.queue.writeBuffer(
                this.vertexBuffer,
                0,
                this.vertices.buffer as ArrayBuffer,
                this.vertices.byteOffset,
                this.vertices.byteLength
            );
        }
        if (this.indices.byteLength > 0) {
            device.queue.writeBuffer(
                this.indexBuffer,
                0,
                this.indices.buffer as ArrayBuffer,
                this.indices.byteOffset,
                this.indices.byteLength
            );
        }
    }

    /**
     * Clears GPU resources. Only destroys buffers if they were created and owned by this instance.
     */
    destroy(): void {
        if (this.gpuOwned) {
            this.vertexBuffer?.destroy();
            this.indexBuffer?.destroy();
        }
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.gpuOwned = false;
    }

    /**
     * Alias for destroy / invalidation on context changes.
     */
    invalidateGpu(): void {
        this.destroy();
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
