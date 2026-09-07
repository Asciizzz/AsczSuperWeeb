import type { Mesh, Submesh, VertexAttribute } from "../mesh.js";

let gMeshIdCounter = 0;

export interface GMeshOptions {
    indexFormat?: GPUIndexFormat;
    indexCount?: number;
    stride?: number;
    attributes?: VertexAttribute[];
    submeshes?: Submesh[];
    label?: string;
}

/**
 * WebGPU GPU-resident Mesh wrapper.
 * Holds vertex and index GPUBuffers directly.
 * Can self-allocate resources (gpuOwned = true) or reference external resources (gpuOwned = false).
 */
export class GMesh {
    readonly id: number;
    name: string;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
    indexCount: number;
    stride: number;
    attributes: VertexAttribute[];
    submeshes: Submesh[];
    gpuOwned: boolean;
    cpuMesh?: Mesh;

    get vertexCount(): number {
        return this.cpuMesh ? this.cpuMesh.vertexCount : (this.stride > 0 ? this.indexCount : 0);
    }

    get indices(): Uint16Array | Uint32Array | { length: number } {
        return this.cpuMesh ? this.cpuMesh.indices : { length: this.indexCount };
    }

    constructor(
        name = "GMesh",
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        options: GMeshOptions = {},
        gpuOwned = false
    ) {
        this.id = ++gMeshIdCounter;
        this.name = name;
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.indexFormat = options.indexFormat ?? "uint16";
        this.indexCount = options.indexCount ?? 0;
        this.stride = options.stride ?? 32;
        this.attributes = options.attributes ? [...options.attributes] : [];
        this.submeshes = options.submeshes ? options.submeshes.map(s => ({ ...s })) : [];
        this.gpuOwned = gpuOwned;
    }

    /**
     * Allocates GPU vertex and index buffers from a CPU Mesh asset and uploads data.
     * Marks the GPU resources as owned by this GMesh instance.
     */
    static fromMesh(device: GPUDevice, mesh: Mesh): GMesh {
        const size = Math.max(32, mesh.vertices.byteLength);
        const vertexBuffer = device.createBuffer({
            label: `GMeshVertex_${mesh.name}_${mesh.id}`,
            size,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        if (mesh.vertices.byteLength > 0) {
            device.queue.writeBuffer(
                vertexBuffer,
                0,
                mesh.vertices.buffer as ArrayBuffer,
                mesh.vertices.byteOffset,
                mesh.vertices.byteLength
            );
        }

        const is32Bit = mesh.indices instanceof Uint32Array;
        const iSize = Math.max(4, mesh.indices.byteLength);
        const indexBuffer = device.createBuffer({
            label: `GMeshIndex_${mesh.name}_${mesh.id}`,
            size: iSize,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        if (mesh.indices.byteLength > 0) {
            device.queue.writeBuffer(
                indexBuffer,
                0,
                mesh.indices.buffer as ArrayBuffer,
                mesh.indices.byteOffset,
                mesh.indices.byteLength
            );
        }

        const gMesh = new GMesh(
            mesh.name,
            vertexBuffer,
            indexBuffer,
            {
                indexFormat: is32Bit ? "uint32" : "uint16",
                indexCount: mesh.indices.length,
                stride: mesh.stride,
                attributes: mesh.attributes,
                submeshes: mesh.submeshes.map(sm => ({ ...sm })),
            },
            true
        );
        gMesh.cpuMesh = mesh;
        return gMesh;
    }

    /**
     * Non-owning reference wrapper for external GPU vertex and index buffers.
     * Ideal for compute-shader output buffers, dynamic particles, or procedural geometry.
     */
    static ref(
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        options: GMeshOptions = {}
    ): GMesh {
        return new GMesh("GMeshRef", vertexBuffer, indexBuffer, options, false);
    }

    /**
     * Re-uploads CPU Mesh vertex and index data into the existing GPU buffers.
     */
    updateFromMesh(device: GPUDevice, mesh: Mesh): void {
        if (mesh.vertices.byteLength > 0) {
            device.queue.writeBuffer(
                this.vertexBuffer,
                0,
                mesh.vertices.buffer as ArrayBuffer,
                mesh.vertices.byteOffset,
                mesh.vertices.byteLength
            );
        }
        if (mesh.indices.byteLength > 0) {
            device.queue.writeBuffer(
                this.indexBuffer,
                0,
                mesh.indices.buffer as ArrayBuffer,
                mesh.indices.byteOffset,
                mesh.indices.byteLength
            );
        }
        this.indexCount = mesh.indices.length;
    }

    /**
     * Clears GPU resources. Only destroys buffers if they were created and owned by this instance.
     */
    destroy(): void {
        if (this.gpuOwned) {
            this.vertexBuffer.destroy();
            this.indexBuffer.destroy();
        }
    }

    /**
     * Alias for destroy on context teardown.
     */
    invalidateGpu(): void {
        this.destroy();
    }
}
