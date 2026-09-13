import type { ComponentSet } from "../../Atoolkit/aecs/index.js";
import {
    AwgpuPass,
    AwgpuBindGroup,
    AwgpuBuffer,
    AwgpuBindSlot,
    AwgpuBindGroupLayoutBuilder,
} from "../../Atoolkit/awgpu/index.js";
import type { GfxTechnique } from "./technique.js";
import type { TransformCmp } from "../components/transform.js";
import type { MeshCmp } from "../components/mesh.js";
import type { MaterialCmp } from "../components/material.js";
import type { SkinCmp } from "../components/skin.js";
import type { Mesh } from "../assets/mesh.js";
import type { ShaderCircuit } from "../assets/shader/circuit.js";
import { GpuMesh } from "../gpu/gmesh.js";
import { GpuShader } from "../gpu/gshader.js";
import { GpuTexture } from "../gpu/gtexture.js";
import { TransformSync } from "../sync/transformSync.js";
import { SkinSync } from "../sync/skinSync.js";

export interface RasterRecordParams {
    passBindGroup: AwgpuBindGroup; // Slot 0
    transforms: ComponentSet<TransformCmp>;
    meshes: ComponentSet<MeshCmp>;
    materials: ComponentSet<MaterialCmp>;
    skins?: ComponentSet<SkinCmp>;
}

/**
 * Forward rasterization rendering technique for 3D/2D meshes.
 * Operates directly on loose ComponentSets with zero central world container.
 */
export class RasterTechnique implements GfxTechnique {
    readonly name = "RasterForwardTechnique";
    private readonly device: GPUDevice;
    private readonly meshCache = new Map<Mesh, GpuMesh>();
    private readonly shaderCache = new Map<ShaderCircuit, GpuShader>();
    private readonly materialBuffers = new Map<MaterialCmp, AwgpuBuffer>();
    private readonly materialBindGroups = new Map<MaterialCmp, AwgpuBindGroup>();
    private readonly transformSync: TransformSync;
    private readonly skinSync: SkinSync;

    constructor(device: GPUDevice) {
        this.device = device;
        const staticInstanceLayout = new AwgpuBindGroupLayoutBuilder()
            .addUniform(0, GPUShaderStage.VERTEX)
            .build(device, "Raster_StaticInstanceLayout");

        this.transformSync = new TransformSync(device, staticInstanceLayout);
        this.skinSync = new SkinSync(device);
    }

    getOrCreateGpuMesh(mesh: Mesh): GpuMesh {
        let gpu = this.meshCache.get(mesh);
        if (!gpu) {
            gpu = GpuMesh.fromMesh(this.device, mesh);
            this.meshCache.set(mesh, gpu);
        }
        return gpu;
    }

    getOrCreateGpuShader(circuit: ShaderCircuit): GpuShader {
        let gpu = this.shaderCache.get(circuit);
        if (!gpu) {
            gpu = GpuShader.fromCircuit(this.device, circuit);
            this.shaderCache.set(circuit, gpu);
        }
        return gpu;
    }

    getOrCreateMaterialBindGroup(mat: MaterialCmp, gpuShader: GpuShader): AwgpuBindGroup {
        let buffer = this.materialBuffers.get(mat);
        let bg = this.materialBindGroups.get(mat);

        if (!buffer || !bg) {
            buffer = AwgpuBuffer.createUniform(
                this.device,
                mat.uniformData,
                `Mat_${mat.circuit.name}_UBO`
            );
            this.materialBuffers.set(mat, buffer);

            const gpuTextures: (GpuTexture | null)[] = mat.textures.map((t) =>
                t ? GpuTexture.fromTexture(this.device, t) : null
            );

            bg = gpuShader.createMaterialBindGroup(this.device, buffer, gpuTextures);
            this.materialBindGroups.set(mat, bg);
            mat.isDirty = false;
            return bg;
        }

        if (mat.isDirty) {
            buffer.write(this.device, mat.uniformData);
            mat.isDirty = false;
        }

        return bg;
    }

    record(pass: AwgpuPass, params: RasterRecordParams): void {
        const { passBindGroup, transforms, meshes, materials, skins } = params;

        // 1. Sync transform buffers
        this.transformSync.syncSet(transforms);
        if (skins) {
            this.skinSync.syncSet(skins);
        }

        // 2. Query renderable entities in O(1)
        for (const [entity, meshCmp] of meshes) {
            if (!meshCmp.visible) continue;

            const transform = transforms.get(entity);
            if (!transform) continue;

            const material = materials.get(entity);
            if (!material) continue;

            const gpuMesh = this.getOrCreateGpuMesh(meshCmp.mesh);
            const gpuShader = this.getOrCreateGpuShader(material.circuit);
            const materialBg = this.getOrCreateMaterialBindGroup(material, gpuShader);

            const skin = skins?.get(entity);
            const isSkinned = !!(skin && gpuShader.skinnedPipeline);
            const pipeline = isSkinned
                ? gpuShader.skinnedPipeline!
                : gpuShader.staticPipeline;

            const transformBinding = this.transformSync.getBinding(entity);
            if (!transformBinding) continue;

            let instanceBg = transformBinding.bindGroup;
            if (isSkinned) {
                const skinBuffer = this.skinSync.getBuffer(entity);
                if (skinBuffer) {
                    const skinnedLayout = new AwgpuBindGroupLayoutBuilder()
                        .addUniform(0, GPUShaderStage.VERTEX)
                        .addStorage(1, GPUShaderStage.VERTEX, { readOnly: true })
                        .build(this.device, "TempSkinnedLayout");

                    instanceBg = AwgpuBindGroup.create(
                        this.device,
                        skinnedLayout,
                        [
                            { binding: 0, resource: transformBinding.buffer },
                            { binding: 1, resource: skinBuffer },
                        ],
                        { slot: AwgpuBindSlot.Instance, label: `Skinned_E${entity}_BG` }
                    );
                }
            }

            // Draw submeshes
            for (const submesh of gpuMesh.submeshes) {
                if (submesh.visible === false) continue;

                pass.addDraw({
                    pipeline,
                    vertexBuffer: gpuMesh.vertexBuffer,
                    indexBuffer: gpuMesh.indexBuffer,
                    indexFormat: gpuMesh.indexFormat,
                    indexCount: submesh.indexCount,
                    indexStart: submesh.indexStart,
                    bindGroups: [passBindGroup, null, materialBg, instanceBg],
                });
            }
        }
    }
}
