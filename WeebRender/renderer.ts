import { Acmp } from "../Atoolkit/acmp/index.js";
import { type Adiag } from "../Atoolkit/adiag/index.js";
import { Aflow } from "../Atoolkit/aflow/index.js";
import { type Aecs } from "../Atoolkit/aecs/index.js";
import { Mat4, Vec3, type M16 } from "../Atoolkit/alm/index.js";
import {
    Backend,
    BeginFrame,
    EndFrame,
    RenderPass,
    EndPass,
    type AwgpuCtx,
} from "../Atoolkit/awgpu/index.js";

import { Mesh, MeshCmp } from "./mesh.js";
import { Texture } from "./texture.js";
import { TransformCmp } from "./transform.js";
import { CameraCmp } from "./camera.js";
import { SkinCmp } from "./skeleton.js";
import { Shader, ShaderParamsCmp, createDefaultShader } from "./shader/index.js";
import { MaterialCmp, type MaterialParamRecord } from "./material.js";

// Re-export frame boundary Acmp steps for explicit frame control
export { BeginFrame as FrameStart, EndFrame as FrameEnd };

// ==================== Scene Draw Acmp Step ====================

/**
 * Acmp Step that populates the active RenderPass with draw instructions
 * compiled from the ECS query of entities with MeshCmp.
 */
export class SceneDrawStep extends Acmp<AwgpuCtx> {
    private renderer: WeebRenderer;

    constructor(renderer: WeebRenderer) {
        super();
        this.renderer = renderer;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render") return;
        this.renderer.executeDrawCalls(ctx.pass as GPURenderPassEncoder);
    }
}

// ==================== Renderer Core ====================

interface GpuMesh {
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexFormat: GPUIndexFormat;
    indexCount: number;
}

const IDENTITY_MATRIX: M16 = Mat4.makeIdentity();

export interface WeebRendererOptions {
    antialias?: boolean;
    clearColor?: { r: number; g: number; b: number; a: number };
}

export class WeebRenderer {
    readonly canvas: HTMLCanvasElement;
    backend: Backend | null = null;
    flow: Aflow<AwgpuCtx> | null = null;

    defaultShader: Shader | null = null;
    pipeline: GPURenderPipeline | null = null;
    cameraBindGroupLayout: GPUBindGroupLayout | null = null;
    objectBindGroupLayout: GPUBindGroupLayout | null = null;
    skinBindGroupLayout: GPUBindGroupLayout | null = null;

    cameraUniformBuffer: GPUBuffer | null = null;
    cameraBindGroup: GPUBindGroup | null = null;
    private cameraData = new Float32Array(20); // 16 floats viewProj + 4 floats eyePos

    depthTexture: GPUTexture | null = null;
    depthTextureView: GPUTextureView | null = null;

    defaultTexture: GPUTexture | null = null;
    defaultTextureView: GPUTextureView | null = null;
    defaultSampler: GPUSampler | null = null;

    // Object uniform buffer pool
    private objectBuffers: GPUBuffer[] = [];
    private objectBindGroups: GPUBindGroup[] = [];
    private objectUniformData = new Float32Array(16); // 16 floats model matrix (64 bytes)

    // Skin storage buffer pool
    private skinBuffers: GPUBuffer[] = [];
    private skinBindGroups: GPUBindGroup[] = [];

    // Material parameter uniform buffer pool & bind group cache
    private materialBuffers: GPUBuffer[] = [];
    private shaderBindGroupCache = new Map<string, GPUBindGroup>();

    // Active frame render state
    currentEcs: Aecs | null = null;
    currentCamera: CameraCmp | null = null;
    clearColor = { r: 0.08, g: 0.09, b: 0.12, a: 1.0 };
    drawCallCount = 0;

    constructor(canvas: HTMLCanvasElement, options: WeebRendererOptions = {}) {
        this.canvas = canvas;
        if (options.clearColor) {
            this.clearColor = { ...options.clearColor };
        }
    }

    /**
     * Initializes Awgpu backend, configures layouts,
     * creates depth stencil and default textures, and builds the Aflow graph.
     */
    async init(): Promise<void> {
        this.backend = await Backend.create(this.canvas);
        const device = this.backend.device!;
        const format = this.backend.format!;

        // 1. Create Bind Group Layouts (Camera: Group 0, Object: Group 1)
        this.cameraBindGroupLayout = device.createBindGroupLayout({
            label: "CameraBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        this.objectBindGroupLayout = device.createBindGroupLayout({
            label: "ObjectBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        this.skinBindGroupLayout = device.createBindGroupLayout({
            label: "SkinBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" },
                },
            ],
        });

        // 2. Allocate Camera Uniform Buffer (80 bytes)
        this.cameraUniformBuffer = device.createBuffer({
            label: "CameraUniformBuffer",
            size: 80,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraBindGroup = device.createBindGroup({
            label: "CameraBindGroup",
            layout: this.cameraBindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: this.cameraUniformBuffer } }],
        });

        // 3. Create Default 1x1 White Fallback Texture
        this.defaultTexture = device.createTexture({
            label: "DefaultWhiteTexture",
            size: [1, 1, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        const whitePixel = new Uint8Array([255, 255, 255, 255]);
        device.queue.writeTexture(
            { texture: this.defaultTexture },
            whitePixel.buffer as ArrayBuffer,
            {bytesPerRow: 4 },
            {width: 1, height: 1 }
        );
        this.defaultTextureView = this.defaultTexture.createView();

        this.defaultSampler = device.createSampler({
            label: "DefaultSampler",
            magFilter: "linear",
            minFilter: "linear",
        });

        // 4. Initialize Default Fallback Shader
        this.defaultShader = createDefaultShader();
        this.defaultShader.initGpu(
            device,
            format,
            this.cameraBindGroupLayout,
            this.objectBindGroupLayout,
            this.skinBindGroupLayout
        );
        this.pipeline = this.defaultShader.pipeline;

        // 5. Setup Depth Texture
        this.resizeDepthTexture();

        // 6. Assemble Aflow Execution Graph
        this.buildRenderFlow();
    }

    /**
     * Builds or rebuilds the Aflow execution graph.
     * Flow structure: FrameStart -> RenderPass -> SceneDrawStep -> EndPass -> FrameEnd.
     */
    buildRenderFlow(): void {
        this.flow = new Aflow<AwgpuCtx>();

        const frameStart = new BeginFrame("WeebRenderFrameStart");
        const renderPass = new RenderPass({
            label: "WeebRenderPass",
            colorAttachments: (ctx: AwgpuCtx) => [
                {
                    view: ctx.canvasCtx!.getCurrentTexture().createView(),
                    clearValue: this.clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: () => ({
                view: this.depthTextureView!,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            }),
        });
        const sceneDraw = new SceneDrawStep(this);
        const endPass = new EndPass();
        const frameEnd = new EndFrame();

        this.flow.addNode({ id: "frame_start", payload: frameStart });
        this.flow.addNode({ id: "render_pass", payload: renderPass });
        this.flow.addNode({ id: "scene_draw",  payload: sceneDraw });
        this.flow.addNode({ id: "end_pass",    payload: endPass });
        this.flow.addNode({ id: "frame_end",   payload: frameEnd });

        this.flow.addLink("frame_start", "render_pass");
        this.flow.addLink("render_pass", "scene_draw");
        this.flow.addLink("scene_draw",  "end_pass");
        this.flow.addLink("end_pass",    "frame_end");
    }

    /**
     * Updates depth texture to match canvas dimensions.
     */
    resizeDepthTexture(): void {
        if (!this.backend?.device) return;
        const width = Math.max(1, this.canvas.width);
        const height = Math.max(1, this.canvas.height);

        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.depthTexture = this.backend.device.createTexture({
            label: "WeebRenderDepthTexture",
            size: [width, height, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.depthTextureView = this.depthTexture.createView();
    }

    /**
     * Resizes internal depth buffers to match current canvas dimensions.
     */
    resize(): void {
        this.resizeDepthTexture();
    }

    /**
     * Ensures GPU buffers for a Mesh asset.
     */
    getOrCreateMeshGpu(mesh: Mesh): Mesh {
        if (!mesh.vertexBuffer || !mesh.indexBuffer) {
            mesh.gpuCreate(this.backend!.device!);
        }
        return mesh;
    }

    /**
     * Acquires or allocates an object uniform buffer for slot index (64-byte model matrix).
     */
    private getObjectUniformBuffer(index: number): { buffer: GPUBuffer; bindGroup: GPUBindGroup } {
        const device = this.backend!.device!;
        while (this.objectBuffers.length <= index) {
            const buffer = device.createBuffer({
                label: `ObjectUniform_${this.objectBuffers.length}`,
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            const bindGroup = device.createBindGroup({
                label: `ObjectBindGroup_${this.objectBindGroups.length}`,
                layout: this.objectBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer } }],
            });
            this.objectBuffers.push(buffer);
            this.objectBindGroups.push(bindGroup);
        }
        return { buffer: this.objectBuffers[index], bindGroup: this.objectBindGroups[index] };
    }

    /**
     * Acquires or allocates a material uniform buffer for slot index.
     */
    private getMaterialUniformBuffer(index: number, sizeBytes: number): GPUBuffer {
        const device = this.backend!.device!;
        const size = Math.max(16, sizeBytes);
        while (this.materialBuffers.length <= index) {
            const buffer = device.createBuffer({
                label: `MaterialUniform_${this.materialBuffers.length}`,
                size,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            this.materialBuffers.push(buffer);
        }
        if (this.materialBuffers[index].size < size) {
            this.materialBuffers[index].destroy();
            this.materialBuffers[index] = device.createBuffer({
                label: `MaterialUniform_${index}`,
                size,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            for (const key of this.shaderBindGroupCache.keys()) {
                if (key.includes(`_slot${index}_`)) {
                    this.shaderBindGroupCache.delete(key);
                }
            }
        }
        return this.materialBuffers[index];
    }

    /**
     * Acquires or allocates a skin storage buffer for slot index.
     */
    private getSkinBuffer(index: number, byteSize: number): { buffer: GPUBuffer; bindGroup: GPUBindGroup } {
        const device = this.backend!.device!;
        const size = Math.max(64, Math.ceil(byteSize / 16) * 16);
        while (this.skinBuffers.length <= index) {
            const buffer = device.createBuffer({
                label: `SkinStorage_${this.skinBuffers.length}`,
                size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const bindGroup = device.createBindGroup({
                label: `SkinBindGroup_${this.skinBindGroups.length}`,
                layout: this.skinBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer } }],
            });
            this.skinBuffers.push(buffer);
            this.skinBindGroups.push(bindGroup);
        }
        if (this.skinBuffers[index].size < size) {
            this.skinBuffers[index].destroy();
            this.skinBuffers[index] = device.createBuffer({
                label: `SkinStorage_${index}`,
                size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            this.skinBindGroups[index] = device.createBindGroup({
                label: `SkinBindGroup_${index}`,
                layout: this.skinBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer: this.skinBuffers[index] } }],
            });
        }
        return { buffer: this.skinBuffers[index], bindGroup: this.skinBindGroups[index] };
    }

    private defaultIdentityPalette: Float32Array | null = null;

    private getDefaultIdentityPalette(jointCount: number): Float32Array {
        const count = Math.max(jointCount, 256);
        if (!this.defaultIdentityPalette || this.defaultIdentityPalette.length < count * 16) {
            const arr = new Float32Array(count * 16);
            for (let i = 0; i < count; i++) {
                arr[i * 16 + 0] = 1;
                arr[i * 16 + 5] = 1;
                arr[i * 16 + 10] = 1;
                arr[i * 16 + 15] = 1;
            }
            this.defaultIdentityPalette = arr;
        }
        return this.defaultIdentityPalette;
    }

    /**
     * Ensures GPU texture view and sampler for a Texture asset.
     */
    getOrCreateTextureResource(texture: Texture | null | undefined): { gpuTex?: GPUTexture; view: GPUTextureView; sampler: GPUSampler } {
        if (!texture) {
            return {
                gpuTex: this.defaultTexture!,
                view: this.defaultTextureView ?? this.defaultTexture!.createView(),
                sampler: this.defaultSampler!,
            };
        }

        if (!texture.gpuView) {
            texture.gpuCreate(this.backend!.device!);
        }

        return {
            gpuTex: texture.gpuTexture ?? undefined,
            view: texture.gpuView!,
            sampler: texture.gpuSampler ?? this.defaultSampler!,
        };
    }

    /**
     * Updates an existing GPU texture buffer in-place with current Texture.data contents.
     */
    updateTexture(texture: Texture): void {
        if (!this.backend?.device) return;
        texture.updateGpu(this.backend.device);
    }

    /**
     * Assembles a Group 2 GPUBindGroup for a ShaderGraph.
     */
    private getOrCreateShaderBindGroup(
        shader: Shader,
        params: MaterialParamRecord | ShaderParamsCmp | null | undefined,
        slot: number
    ): GPUBindGroup {
        const device = this.backend!.device!;
        const queue = device.queue;

        const paramValues = params instanceof ShaderParamsCmp ? params.values : (params ?? undefined);

        // 1. Fill parameter uniforms
        const workingData = new Float32Array(shader.paramLayout.defaultUniformData);
        if (paramValues) {
            for (const [key, val] of Object.entries(paramValues)) {
                const def = shader.paramLayout.uniforms.get(key);
                if (def) {
                    const floatOffset = def.byteOffset / 4;
                    if (def.type === "vec4" && (Array.isArray(val) || val instanceof Float32Array)) {
                        workingData.set(val as ArrayLike<number>, floatOffset);
                    } else if (def.type === "float" && typeof val === "number") {
                        workingData[floatOffset] = val;
                    }
                }
            }
        }

        const matBuffer = this.getMaterialUniformBuffer(slot, workingData.byteLength);
        queue.writeBuffer(
            matBuffer,
            0,
            workingData.buffer as ArrayBuffer,
            workingData.byteOffset,
            workingData.byteLength
        );

        // 2. Build entries and cache key
        let texKey = "";
        const entries: GPUBindGroupEntry[] = [
            { binding: 0, resource: { buffer: matBuffer } },
        ];

        for (let i = 0; i < shader.blueprint.textureNodes.length; i++) {
            const texNode = shader.blueprint.textureNodes[i];
            const paramName = texNode.paramName ?? texNode.id;
            const texVal = (paramValues?.[paramName] as Texture | undefined)
                ?? texNode.defaultTexture;

            const res = this.getOrCreateTextureResource(texVal);
            texKey += `_${texVal?.id ?? 0}`;
            entries.push(
                { binding: 1 + i * 2, resource: res.view },
                { binding: 2 + i * 2, resource: res.sampler }
            );
        }

        const bindGroupKey = `${shader.id}_slot${slot}_${texKey}`;
        let cached = this.shaderBindGroupCache.get(bindGroupKey);
        if (!cached) {
            cached = device.createBindGroup({
                label: `ShaderBindGroup_${shader.name}_${slot}`,
                layout: shader.materialBindGroupLayout!,
                entries,
            });
            this.shaderBindGroupCache.set(bindGroupKey, cached);
        }
        return cached;
    }

    /**
     * Executes all scene draw calls inside the active RenderPass.
     */
    executeDrawCalls(pass: GPURenderPassEncoder): void {
        const ecs = this.currentEcs;
        const camera = this.currentCamera;
        if (!ecs || !camera || !this.cameraBindGroup) return;

        const device = this.backend!.device!;
        const queue = device.queue;

        // 1. Upload Camera Uniform Buffer (viewProjMatrix + camera position)
        this.cameraData.set(camera.viewProjMatrix, 0);
        this.cameraData[16] = camera.eyePos[0];
        this.cameraData[17] = camera.eyePos[1];
        this.cameraData[18] = camera.eyePos[2];
        this.cameraData[19] = 1.0;
        queue.writeBuffer(
            this.cameraUniformBuffer!,
            0,
            this.cameraData.buffer as ArrayBuffer,
            this.cameraData.byteOffset,
            this.cameraData.byteLength
        );

        // 2. Set Camera Bind Group at Group 0
        pass.setBindGroup(0, this.cameraBindGroup);

        let drawSlot = 0;
        let lastPipeline: GPURenderPipeline | null = null;
        this.drawCallCount = 0;

        // 3. Flat Query: ECS Entities with MeshCmp
        for (const [entity, meshCmp] of ecs.query(MeshCmp)) {
            if (!meshCmp.visible) continue;
            const mesh = meshCmp.rMesh;
            if (!mesh || mesh.vertexCount === 0 || mesh.indices.length === 0) continue;

            // Resolve Transform: If missing, fallback to identity matrix (0, 0, 0)
            const transform = ecs.get(entity, TransformCmp);
            let worldMatrix = IDENTITY_MATRIX;
            if (transform) {
                if (transform.isDirty) {
                    transform.updateMatrix();
                }
                worldMatrix = transform.worldMatrix;
            }

            // Resolve Material Component
            const materialCmp = ecs.get(entity, MaterialCmp);

            // Resolve Skin Component directly on the entity
            const skinCmp = ecs.get(entity, SkinCmp);

            // Ensure Mesh GPU buffers
            const gpuMesh = this.getOrCreateMeshGpu(mesh);
            if (!gpuMesh.vertexBuffer || !gpuMesh.indexBuffer) continue;
            pass.setVertexBuffer(0, gpuMesh.vertexBuffer);
            pass.setIndexBuffer(gpuMesh.indexBuffer, gpuMesh.indexFormat);

            // Iterate through submeshes
            const submeshes = mesh.submeshes.length > 0
                ? mesh.submeshes
                : [{ name: "All", indexStart: 0, indexCount: mesh.indices.length }];

            for (let sIdx = 0; sIdx < submeshes.length; sIdx++) {
                const submesh = submeshes[sIdx];
                if (submesh.visible === false) continue;

                // Shader resolution: MaterialCmp slot sIdx -> MaterialCmp slot 0 -> defaultShader
                const shader = materialCmp?.shaders[sIdx]
                    ?? materialCmp?.shaders[0]
                    ?? this.defaultShader;
                if (!shader) continue;

                // Determine whether skinning should be active for this mesh
                // Active skinning requires BOTH stride 64 AND an attached SkinCmp
                const hasSkin = mesh.stride === 64 && !!skinCmp;

                const pipeline = shader.getOrCreatePipeline(
                    device,
                    this.backend!.format!,
                    mesh.stride,
                    hasSkin,
                    this.cameraBindGroupLayout!,
                    this.objectBindGroupLayout!,
                    this.skinBindGroupLayout!
                );

                if (lastPipeline !== pipeline) {
                    pass.setPipeline(pipeline);
                    lastPipeline = pipeline;
                }

                // Object uniform (model matrix)
                this.objectUniformData.set(worldMatrix, 0);
                const { buffer: objBuffer, bindGroup: objBindGroup } = this.getObjectUniformBuffer(drawSlot);
                queue.writeBuffer(
                    objBuffer,
                    0,
                    this.objectUniformData.buffer as ArrayBuffer,
                    this.objectUniformData.byteOffset,
                    this.objectUniformData.byteLength
                );
                pass.setBindGroup(1, objBindGroup);

                // Material & Texture Bind Group (Slot sIdx params -> Slot 0 params)
                const effectiveParams = materialCmp?.params[sIdx]
                    ?? materialCmp?.params[0]
                    ?? undefined;

                const matBindGroup = this.getOrCreateShaderBindGroup(
                    shader,
                    effectiveParams,
                    drawSlot
                );
                pass.setBindGroup(2, matBindGroup);

                // Skin Bind Group (Group 3) only when active skinning is enabled
                if (hasSkin) {
                    if (skinCmp && skinCmp.jointPalette.byteLength > 0) {
                        const { buffer: sBuffer, bindGroup: sBindGroup } = this.getSkinBuffer(
                            drawSlot,
                            skinCmp.jointPalette.byteLength
                        );
                        queue.writeBuffer(
                            sBuffer,
                            0,
                            skinCmp.jointPalette.buffer as ArrayBuffer,
                            skinCmp.jointPalette.byteOffset,
                            skinCmp.jointPalette.byteLength
                        );
                        pass.setBindGroup(3, sBindGroup);
                    } else {
                        // Fallback identity matrices if palette not yet computed
                        const jointCount = Math.max(skinCmp?.rSkeleton?.joints?.length ?? 1, 256);
                        const bufferSize = jointCount * 64;
                        const { buffer: sBuffer, bindGroup: sBindGroup } = this.getSkinBuffer(drawSlot, bufferSize);
                        const palette = this.getDefaultIdentityPalette(jointCount);
                        queue.writeBuffer(
                            sBuffer,
                            0,
                            palette.buffer as ArrayBuffer,
                            palette.byteOffset,
                            palette.byteLength
                        );
                        pass.setBindGroup(3, sBindGroup);
                    }
                }

                drawSlot++;
                const maxCount = Math.max(0, mesh.indices.length - submesh.indexStart);
                const safeCount = Math.min(submesh.indexCount, maxCount);
                if (safeCount > 0) {
                    pass.drawIndexed(safeCount, 1, submesh.indexStart, 0, 0);
                    this.drawCallCount++;
                }
            }
        }
    }

    /**
     * Main entry point to render an ECS scene with a CameraCmp.
     * Executes the compiled Aflow graph between FrameStart and FrameEnd.
     */
    render(ecs: Aecs, camera: CameraCmp, clearColor?: { r: number; g: number; b: number; a: number }): void {
        if (!this.flow || !this.backend) return;

        // Auto-check canvas drawing buffer dimensions and resize depth texture if mismatched
        const width = Math.max(1, this.canvas.width);
        const height = Math.max(1, this.canvas.height);
        if (!this.depthTexture || this.depthTexture.width !== width || this.depthTexture.height !== height) {
            this.resizeDepthTexture();
        }

        this.currentEcs = ecs;
        this.currentCamera = camera;
        if (clearColor) {
            this.clearColor = { ...clearColor };
        }

        // Execute render graph with a fresh frame context
        const ctx = this.backend.newCtx();
        this.flow.run("frame_start", { ctx });
    }

    /**
     * Evicts cached material bind groups. If shaderId is given, evicts only that shader's entries.
     */
    clearShaderBindGroupCache(shaderId?: number): void {
        if (shaderId !== undefined) {
            const prefix = `${shaderId}_`;
            for (const key of this.shaderBindGroupCache.keys()) {
                if (key.startsWith(prefix)) {
                    this.shaderBindGroupCache.delete(key);
                }
            }
        } else {
            this.shaderBindGroupCache.clear();
        }
    }
}
