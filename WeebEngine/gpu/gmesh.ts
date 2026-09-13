import { AwgpuBuffer, createVertexLayout, type AwgpuVertexAttributeDesc } from "../../Atoolkit/awgpu/index.js";
import { Mesh, type Submesh } from "../assets/mesh.js";

let nextGpuMeshId = 0;

/**
 * GPU geometry resource wrapper.
 * Holds vertex buffer, index buffer, vertex layout, and submesh partitions.
 */
export class GpuMesh {
    readonly id: number;
    name: string;
    readonly vertexBuffer: AwgpuBuffer;
    readonly indexBuffer: AwgpuBuffer;
    readonly indexFormat: GPUIndexFormat;
    readonly indexCount: number;
    readonly vertexCount: number;
    readonly stride: number;
    readonly submeshes: Submesh[];
    readonly vertexLayout: GPUVertexBufferLayout;

    constructor(
        vertexBuffer: AwgpuBuffer,
        indexBuffer: AwgpuBuffer,
        indexFormat: GPUIndexFormat,
        indexCount: number,
        vertexCount: number,
        stride: number,
        submeshes: Submesh[],
        vertexLayout: GPUVertexBufferLayout,
        name = "GpuMesh"
    ) {
        this.id = ++nextGpuMeshId;
        this.name = name;
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.indexFormat = indexFormat;
        this.indexCount = indexCount;
        this.vertexCount = vertexCount;
        this.stride = stride;
        this.submeshes = submeshes;
        this.vertexLayout = vertexLayout;
    }

    destroy(): void {
        this.vertexBuffer.destroy();
        this.indexBuffer.destroy();
    }

    static fromMesh(device: GPUDevice, mesh: Mesh): GpuMesh {
        const vertexBuf = AwgpuBuffer.createVertex(device, mesh.vertices, `${mesh.name}_VBO`);
        const indexBuf = AwgpuBuffer.createIndex(device, mesh.indices, `${mesh.name}_IBO`);

        const indexFormat: GPUIndexFormat = mesh.indices instanceof Uint32Array ? "uint32" : "uint16";

        let descs: AwgpuVertexAttributeDesc[];
        if (mesh.attributes && mesh.attributes.length > 0) {
            descs = mesh.attributes.map((a) => ({
                shaderLocation: a.shaderLocation,
                format: a.format as GPUVertexFormat,
                offset: a.offset,
            }));
        } else if (mesh.stride >= 64) {
            // Skinned layout (64 bytes)
            descs = [
                { shaderLocation: 0, format: "float32x3", offset: 0 },
                { shaderLocation: 1, format: "float32x3", offset: 12 },
                { shaderLocation: 2, format: "float32x2", offset: 24 },
                { shaderLocation: 3, format: "uint32x4", offset: 32 },
                { shaderLocation: 4, format: "float32x4", offset: 48 },
            ];
        } else {
            // Static layout (32 bytes)
            descs = [
                { shaderLocation: 0, format: "float32x3", offset: 0 },
                { shaderLocation: 1, format: "float32x3", offset: 12 },
                { shaderLocation: 2, format: "float32x2", offset: 24 },
            ];
        }

        const vertexLayout = createVertexLayout(descs);

        return new GpuMesh(
            vertexBuf,
            indexBuf,
            indexFormat,
            mesh.indexCount,
            mesh.vertexCount,
            mesh.stride,
            mesh.submeshes,
            vertexLayout,
            mesh.name
        );
    }
}
