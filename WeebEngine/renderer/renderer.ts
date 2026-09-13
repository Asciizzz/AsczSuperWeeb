import {
    AwgpuDevice,
    AwgpuRenderTarget,
    AwgpuPass,
    AwgpuFrame,
} from "../../Atoolkit/awgpu/index.js";
import { type M16 } from "../../Atoolkit/alm/index.js";
import type { Mesh } from "../assets/mesh.js";
import type { Skeleton } from "../assets/skeleton.js";
import type { Texture } from "../assets/texture.js";
import type { ShaderCircuit } from "../assets/shader/circuit.js";
import { GpuMesh } from "../gpu/gmesh.js";
import { GpuTexture } from "../gpu/gtexture.js";
import { GpuSkin } from "../gpu/gskin.js";
import { GpuTransform } from "../gpu/gtransform.js";
import { GpuShader, type GpuShaderOptions } from "../gpu/gshader.js";
import { TransformSystem } from "../systems/transformSystem.js";
import { SkinSystem } from "../systems/skinSystem.js";
import type { WeebWorld } from "../ecs/world.js";
import type { Camera } from "./camera.js";

export interface WeebRendererOptions {
    clearColor?: { r: number; g: number; b: number; a: number };
    depthFormat?: GPUTextureFormat | null;
}

/**
 * WebGPU rendering engine executing ECS scene state through modern Awgpu passes.
 */
export class WeebRenderer {
    readonly device: AwgpuDevice;
    screenTarget: AwgpuRenderTarget;
    defaultTexture: GpuTexture;

    constructor(device: AwgpuDevice, options: WeebRendererOptions = {}) {
        this.device = device;
        const depthFormat = options.depthFormat === null ? null : (options.depthFormat ?? "depth24plus");
        this.screenTarget = AwgpuRenderTarget.createScreen(device, {
            depthFormat,
            clearColor: options.clearColor ?? { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        });
        this.defaultTexture = GpuTexture.createSolid(device.device, 255, 255, 255, 255);
    }

    createMesh(mesh: Mesh): GpuMesh {
        return GpuMesh.fromMesh(this.device.device, mesh);
    }

    createTexture(texture: Texture): GpuTexture {
        return GpuTexture.fromTexture(this.device.device, texture);
    }

    createShader(circuit: ShaderCircuit, options?: GpuShaderOptions): GpuShader {
        return GpuShader.fromCircuit(this.device.device, circuit, {
            targetFormat: this.device.format,
            depthFormat: this.screenTarget.depthAttachment?.texture.format ?? null,
            ...options,
        });
    }

    createTransform(initialMatrix?: M16): GpuTransform {
        return GpuTransform.create(this.device.device, initialMatrix);
    }

    createSkin(skeleton: Skeleton): GpuSkin {
        return GpuSkin.fromSkeleton(this.device.device, skeleton);
    }

    resize(): void {
        if (this.device.canvas) {
            this.screenTarget.resize(this.device.device, this.device.canvas.width, this.device.canvas.height);
        }
    }

    render(
        world: WeebWorld,
        camera: Camera,
        target?: AwgpuRenderTarget
    ): void {
        // 1. Synchronize camera uniform buffer
        camera.syncBuffer(this.device.device);

        // 2. Evaluate dirty transform matrices and upload to GPU buffers
        TransformSystem.update(world, this.device.device);

        // 3. Evaluate dirty skeletal bone palettes and upload to GPU buffers
        SkinSystem.update(world, this.device.device);

        // 4. Construct render pass
        const renderTarget = target ?? this.screenTarget;
        const pass = new AwgpuPass("ScenePass", renderTarget);

        // 5. Query renderable entities in O(1) per entity
        for (const [entity, meshCmp] of world.meshes) {
            if (!meshCmp.visible) continue;

            const transform = world.transforms.get(entity);
            if (!transform) continue;

            const shaderCmp = world.shaders.get(entity);
            if (!shaderCmp) continue;

            const skinCmp = world.skins.get(entity);
            const pipeline = (skinCmp && shaderCmp.rShader.skinnedPipeline)
                ? shaderCmp.rShader.skinnedPipeline
                : shaderCmp.rShader.staticPipeline;

            const instanceBg = transform.rTransform.getBindGroup(
                this.device.device,
                skinCmp?.rSkin
            );

            for (const submesh of meshCmp.rMesh.submeshes) {
                if (submesh.visible === false) continue;
                const material = shaderCmp.getMaterial(submesh.shaderSlot ?? 0);

                pass.addDraw({
                    pipeline,
                    vertexBuffer: meshCmp.rMesh.vertexBuffer,
                    indexBuffer: meshCmp.rMesh.indexBuffer,
                    indexFormat: meshCmp.rMesh.indexFormat,
                    indexCount: submesh.indexCount,
                    indexStart: submesh.indexStart,
                    bindGroups: [camera.bindGroup, null, material?.bindGroup, instanceBg],
                });
            }
        }

        // 6. Execute frame
        const frame = new AwgpuFrame();
        frame.addPass(pass);
        frame.execute(this.device);
    }
}
