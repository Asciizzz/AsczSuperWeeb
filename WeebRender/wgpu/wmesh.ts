import { GpuMesh } from "../gpu.js";
import type { Mesh, Submesh, VertexAttribute } from "../mesh.js";

export interface WgpuMeshPayload {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
}

export interface WgpuMeshOptions {
    indexFormat?: GPUIndexFormat;
    indexCount?: number;
    stride?: number;
    attributes?: VertexAttribute[];
    submeshes?: Submesh[];
    label?: string;
}

function writeBufferPadded(
    device: GPUDevice,
    buffer: GPUBuffer,
    sourceArray: ArrayBufferView,
    byteOffset: number,
    byteLength: number
): void {
    if (byteLength <= 0) return;
    if (byteLength % 4 === 0) {
        device.queue.writeBuffer(
            buffer,
            0,
            sourceArray.buffer as ArrayBuffer,
            byteOffset,
            byteLength
        );
    } else {
        const paddedSize = Math.ceil(byteLength / 4) * 4;
        const padded = new Uint8Array(paddedSize);
        padded.set(new Uint8Array(sourceArray.buffer as ArrayBuffer, byteOffset, byteLength));
        device.queue.writeBuffer(buffer, 0, padded.buffer, 0, paddedSize);
    }
}

/**
 * WebGPU GPU-resident Mesh wrapper.
 * Extends GpuMesh<WgpuMeshPayload> to provide typed WebGPU accessors.
 */
export class WgpuMesh extends GpuMesh<WgpuMeshPayload> {
    get vertexBuffer(): GPUBuffer {
        return this.backend.vertexBuffer;
    }

    get indexBuffer(): GPUBuffer {
        return this.backend.indexBuffer;
    }

    get indexFormat(): GPUIndexFormat {
        return this.backend.indexFormat;
    }

    get indices(): Uint16Array | Uint32Array | { length: number } {
        return this.cpuMesh ? this.cpuMesh.indices : { length: this.indexCount };
    }

    constructor(
        name = "WgpuMesh",
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        options: WgpuMeshOptions = {},
        gpuOwned = false
    ) {
        const indexFormat = options.indexFormat ?? "uint16";
        const indexCount = options.indexCount ?? 0;
        const stride = options.stride ?? 32;
        const attributes = options.attributes ? [...options.attributes] : [];
        const submeshes = options.submeshes ? options.submeshes.map(s => ({ ...s })) : [];
        const vertexCount = stride > 0 ? indexCount : 0;

        super(name, vertexCount, indexCount, stride, attributes, submeshes, {
            vertexBuffer,
            indexBuffer,
            indexFormat,
        }, gpuOwned);
    }

    /**
     * Allocates GPU vertex and index buffers from a CPU Mesh asset and uploads data.
     * Marks the GPU resources as owned by this WgpuMesh instance.
     */
    static fromMesh(device: GPUDevice, mesh: Mesh): WgpuMesh {
        const vByteLen = mesh.vertices.byteLength;
        const vSize = Math.max(32, Math.ceil(vByteLen / 4) * 4);
        const vertexBuffer = device.createBuffer({
            label: `WgpuMeshVertex_${mesh.name}_${mesh.id}`,
            size: vSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        writeBufferPadded(device, vertexBuffer, mesh.vertices, mesh.vertices.byteOffset, vByteLen);

        const is32Bit = mesh.indices instanceof Uint32Array;
        const iByteLen = mesh.indices.byteLength;
        const iSize = Math.max(4, Math.ceil(iByteLen / 4) * 4);
        const indexBuffer = device.createBuffer({
            label: `WgpuMeshIndex_${mesh.name}_${mesh.id}`,
            size: iSize,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        writeBufferPadded(device, indexBuffer, mesh.indices, mesh.indices.byteOffset, iByteLen);

        const wMesh = new WgpuMesh(
            mesh.name,
            vertexBuffer,
            indexBuffer,
            {
                indexFormat: is32Bit ? "uint32" : "uint16",
                indexCount: mesh.indices.length,
                stride: mesh.stride,
                attributes: mesh.attributes,
                submeshes: mesh.submeshes,
            },
            true
        );
        wMesh.cpuMesh = mesh;
        return wMesh;
    }

    /**
     * Non-owning reference wrapper for external GPU buffers.
     * Ideal for procedural compute passes, dynamic streaming, or shared geometry.
     */
    static ref(
        vertexBuffer: GPUBuffer,
        indexBuffer: GPUBuffer,
        options: WgpuMeshOptions & { name?: string }
    ): WgpuMesh {
        return new WgpuMesh(
            options.name ?? "WgpuMeshRef",
            vertexBuffer,
            indexBuffer,
            options,
            false
        );
    }

    /**
     * Updates an existing WgpuMesh with new vertex and index data from a CPU Mesh asset.
     */
    updateFromMesh(device: GPUDevice, mesh: Mesh): void {
        const vByteLen = mesh.vertices.byteLength;
        const vPaddedSize = Math.max(32, Math.ceil(vByteLen / 4) * 4);
        if (vByteLen > 0) {
            if (this.gpuOwned && vPaddedSize > this.vertexBuffer.size) {
                this.vertexBuffer.destroy();
                this.backend.vertexBuffer = device.createBuffer({
                    label: `WgpuMeshVertex_${mesh.name}_${mesh.id}`,
                    size: vPaddedSize,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
            }
            if (vByteLen <= this.vertexBuffer.size) {
                writeBufferPadded(device, this.vertexBuffer, mesh.vertices, mesh.vertices.byteOffset, vByteLen);
            }
        }

        const is32Bit = mesh.indices instanceof Uint32Array;
        const iByteLen = mesh.indices.byteLength;
        const iPaddedSize = Math.max(4, Math.ceil(iByteLen / 4) * 4);
        if (iByteLen > 0) {
            if (this.gpuOwned && iPaddedSize > this.indexBuffer.size) {
                this.indexBuffer.destroy();
                this.backend.indexBuffer = device.createBuffer({
                    label: `WgpuMeshIndex_${mesh.name}_${mesh.id}`,
                    size: iPaddedSize,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                });
            }
            if (iByteLen <= this.indexBuffer.size) {
                writeBufferPadded(device, this.indexBuffer, mesh.indices, mesh.indices.byteOffset, iByteLen);
            }
        }

        this.backend.indexFormat = is32Bit ? "uint32" : "uint16";
        this.indexCount = mesh.indices.length;
        this.stride = mesh.stride;
        this.attributes = [...mesh.attributes];
        this.submeshes = mesh.submeshes.map(s => ({ ...s }));
        this.cpuMesh = mesh;
    }

    /**
     * Releases owned WebGPU vertex and index buffer resources.
     */
    destroy(): void {
        if (this.gpuOwned) {
            this.vertexBuffer.destroy();
            this.indexBuffer.destroy();
        }
    }
}

// Ergonomic aliases
export { WgpuMesh as GMesh };
export type { WgpuMeshOptions as GMeshOptions };

