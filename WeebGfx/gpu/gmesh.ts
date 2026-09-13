import { AwgpuBuffer, createVertexLayout, type AwgpuVertexAttributeDesc } from "../../Atoolkit/awgpu/index.js";
import type { Mesh, SubmeshDesc } from "../assets/mesh.js";

/**
 * GPU geometry representation managing hardware vertex/index buffers and vertex layout.
 */
export class GpuMesh {
    readonly vertexBuffer: AwgpuBuffer;
    readonly indexBuffer: AwgpuBuffer;
    readonly indexFormat: GPUIndexFormat;
    readonly vertexLayout: GPUVertexBufferLayout;
    readonly submeshes: SubmeshDesc[];

    constructor(
        device: GPUDevice,
        mesh: Mesh
    ) {
        this.vertexBuffer = AwgpuBuffer.createVertex(
            device,
            mesh.vertexData,
            `${mesh.name}_VBO`
        );

        this.indexBuffer = AwgpuBuffer.createIndex(
            device,
            mesh.indexData,
            `${mesh.name}_IBO`
        );

        this.indexFormat = mesh.isIndex32 ? "uint32" : "uint16";
        this.submeshes = [...mesh.submeshes];

        const attrDescs: AwgpuVertexAttributeDesc[] = mesh.attributes.map((attr, idx) => ({
            shaderLocation: idx,
            format: attr.format,
            offset: attr.offset,
        }));

        this.vertexLayout = createVertexLayout(attrDescs, "vertex");
    }

    static fromMesh(device: GPUDevice, mesh: Mesh): GpuMesh {
        return new GpuMesh(device, mesh);
    }
}
