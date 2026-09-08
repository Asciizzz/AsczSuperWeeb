import { Acmp } from "../../Atoolkit/acmp/index.js";
import { type Adiag } from "../../Atoolkit/adiag/index.js";
import { Aflow, type Anode } from "../../Atoolkit/aflow/index.js";
import { type Aecs } from "../../Atoolkit/aecs/index.js";
import { Mat4, Vec3, type M16 } from "../../Atoolkit/alm/index.js";
import {
    Backend,
    BeginFrame,
    EndFrame,
    RenderPass,
    EndPass,
    type AwgpuCtx,
} from "../../Atoolkit/awgpu/index.js";

import { Mesh, MeshCmp } from "../mesh.js";
import { Texture } from "../texture.js";
import { TransformCmp } from "../transform.js";
import { CameraCmp } from "../camera.js";
import { SkinCmp } from "../skeleton.js";
import { MaterialCmp, type MaterialParamRecord } from "../material.js";
import { ShaderParamsCmp } from "../shader/params.js";
import { ShaderCircuit } from "../shader/circuit.js";
import { ColorNode } from "../shader/nodes/color.js";

import { WgpuMesh, GMesh } from "./wmesh.js";
import { WgpuTexture, GTexture } from "./wtexture.js";
import { WgpuShader, GShader } from "./wshader.js";

// Re-export frame and pass components for external flow composition
export {
    BeginFrame,
    EndFrame,
    BeginFrame as FrameStart,
    EndFrame as FrameEnd,
    RenderPass,
    EndPass,
    type AwgpuCtx,
};

// ==================== Scene Draw Acmp Component ====================

/**
 * Acmp component that populates the active RenderPass with draw instructions
 * compiled from the ECS query of entities with MeshCmp (holding GMesh).
 */
export class SceneDrawCmp extends Acmp<AwgpuCtx> {
    private renderer: WgpuRenderer;

    constructor(renderer: WgpuRenderer) {
        super();
        this.renderer = renderer;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render") return;
        this.renderer.executeDrawCalls(ctx.pass as GPURenderPassEncoder);
    }
}

export { SceneDrawCmp as SceneDrawStep };

// ==================== Renderer Core ====================

const IDENTITY_MATRIX: M16 = Mat4.makeIdentity();

export interface WgpuRendererOptions {
    antialias?: boolean;
    clearColor?: { r: number; g: number; b: number; a: number };
    parentNode?: Anode<Acmp<AwgpuCtx>[]>;
    target?: WgpuTexture | null;
    label?: string;
    backend?: Backend;
}

/**
 * WebGPU rendering engine.
 * Operates strictly on GPU-resident data wrappers (GMesh, GTexture, GShader).
 * Controls rendering up to the RenderPass level and mounts into an external Aflow node.
 */
export class WgpuRenderer {
    readonly canvas: HTMLCanvasElement;
    backend: Backend | null = null;
    label: string;

    parentNode: Anode<Acmp<AwgpuCtx>[]> | null = null;
    target: WgpuTexture | null = null;

    renderPassCmp: RenderPass | null = null;
    sceneDrawCmp: SceneDrawCmp | null = null;
    endPassCmp: EndPass | null = null;

    get renderPassStep(): RenderPass | null { return this.renderPassCmp; }
    set renderPassStep(v: RenderPass | null) { this.renderPassCmp = v; }
    get sceneDrawStep(): SceneDrawCmp | null { return this.sceneDrawCmp; }
    set sceneDrawStep(v: SceneDrawCmp | null) { this.sceneDrawCmp = v; }
    get endPassStep(): EndPass | null { return this.endPassCmp; }
    set endPassStep(v: EndPass | null) { this.endPassCmp = v; }

    defaultShader: GShader | null = null;
    pipeline: GPURenderPipeline | null = null;
    cameraBindGroupLayout: GPUBindGroupLayout | null = null;
    objectBindGroupLayout: GPUBindGroupLayout | null = null;
    skinBindGroupLayout: GPUBindGroupLayout | null = null;

    cameraUniformBuffer: GPUBuffer | null = null;
    cameraBindGroup: GPUBindGroup | null = null;
    private cameraData = new Float32Array(20); // 16 floats viewProj + 4 floats eyePos

    depthTexture: GPUTexture | null = null;
    depthTextureView: GPUTextureView | null = null;

    defaultGTexture: GTexture | null = null;

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

    private standaloneStartCmp = new BeginFrame("StandaloneFrameStart");
    private standaloneEndCmp = new EndFrame();

    constructor(canvas: HTMLCanvasElement, options: WgpuRendererOptions = {}) {
        this.canvas = canvas;
        this.label = options.label ?? "WgpuRenderer";
        if (options.clearColor) {
            this.clearColor = { ...options.clearColor };
        }
        if (options.target) {
            this.target = options.target;
        }
        if (options.backend) {
            this.backend = options.backend;
        }
        if (options.parentNode) {
            this.parentNode = options.parentNode;
        }
    }

    get device(): GPUDevice | null {
        return this.backend?.device ?? null;
    }

    get format(): GPUTextureFormat | null {
        return this.backend?.format ?? null;
    }

    /**
     * Helper factory: Allocates and uploads a CPU Mesh into a GMesh on this renderer's device.
     */
    createMesh(mesh: Mesh): GMesh {
        if (!this.backend?.device) {
            throw new Error("[WgpuRenderer.createMesh] Renderer must be initialized with init() before creating GPU meshes.");
        }
        return GMesh.fromMesh(this.backend.device, mesh);
    }

    /**
     * Helper factory: Allocates and uploads a CPU Texture into a GTexture on this renderer's device.
     */
    createTexture(texture: Texture): GTexture {
        if (!this.backend?.device) {
            throw new Error("[WgpuRenderer.createTexture] Renderer must be initialized with init() before creating GPU textures.");
        }
        return GTexture.fromTexture(this.backend.device, texture);
    }

    /**
     * Helper factory: Allocates a GPU render target texture for Render-to-Texture (RTT).
     * Returns a WgpuTexture (GpuTexture) that can be sampled by ShaderCircuit or used as an offscreen target.
     */
    createRenderTarget(width: number, height: number, label = "RenderTarget"): WgpuTexture {
        if (!this.backend?.device) {
            throw new Error("[WgpuRenderer.createRenderTarget] Renderer must be initialized with init() before creating render targets.");
        }
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        const device = this.backend.device;
        const gpuTexture = device.createTexture({
            label,
            size: [w, h, 1],
            format: this.backend.format ?? "bgra8unorm",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        const gpuView = gpuTexture.createView();
        const gpuSampler = device.createSampler({
            label: `${label}_Sampler`,
            magFilter: "linear",
            minFilter: "linear",
        });
        return new WgpuTexture(label, gpuTexture, gpuView, gpuSampler, w, h, true);
    }

    /**
     * Initializes Awgpu backend, configures layouts,
     * creates depth stencil and default textures, and builds the pass components.
     */
    async init(backend?: Backend): Promise<void> {
        if (backend) {
            this.backend = backend;
        } else if (!this.backend) {
            this.backend = await Backend.create(this.canvas);
        }
        const device = this.backend.device!;
        const format = this.backend.format!;

        // 1. Create Bind Group Layouts (Camera: Group 0, Object: Group 1, Skin: Group 3)
        this.cameraBindGroupLayout = device.createBindGroupLayout({
            label: `${this.label}_CameraBindGroupLayout`,
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        this.objectBindGroupLayout = device.createBindGroupLayout({
            label: `${this.label}_ObjectBindGroupLayout`,
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" },
                },
            ],
        });

        this.skinBindGroupLayout = device.createBindGroupLayout({
            label: `${this.label}_SkinBindGroupLayout`,
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
            label: `${this.label}_CameraUniformBuffer`,
            size: 80,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraBindGroup = device.createBindGroup({
            label: `${this.label}_CameraBindGroup`,
            layout: this.cameraBindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: this.cameraUniformBuffer } }],
        });

        // 3. Create Default 1x1 White Fallback GTexture
        const defaultTex = device.createTexture({
            label: `${this.label}_DefaultWhiteTexture`,
            size: [1, 1, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        const whitePixel = new Uint8Array([255, 255, 255, 255]);
        device.queue.writeTexture(
            { texture: defaultTex },
            whitePixel.buffer as ArrayBuffer,
            { bytesPerRow: 4 },
            { width: 1, height: 1 }
        );
        const defaultView = defaultTex.createView();
        const defaultSampler = device.createSampler({
            label: `${this.label}_DefaultSampler`,
            magFilter: "linear",
            minFilter: "linear",
        });
        this.defaultGTexture = new GTexture("DefaultWhite", defaultTex, defaultView, defaultSampler, 1, 1, true);

        // 4. Initialize Default Fallback Shader
        this.defaultShader = this.createDefaultShader();
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

        // 6. Build RenderPass and SceneDrawCmp components
        this.buildPassCmps();

        // 7. Mount to parentNode if provided
        if (this.parentNode) {
            this.mountPassCmps();
        }
    }

    private createDefaultShader(): GShader {
        const circuit = new ShaderCircuit("DefaultShader");
        const colorNode = new ColorNode("colorNode", [1, 1, 1, 1], true, "baseColor");
        circuit.addNode(colorNode);
        circuit.connect(colorNode, "color", circuit.outputNode, "baseColor");
        return new GShader(circuit);
    }

    /**
     * Builds the pass-level components: RenderPass, SceneDrawCmp, and EndPass.
     */
    buildPassCmps(): void {
        this.renderPassCmp = new RenderPass({
            label: `${this.label}_Pass`,
            colorAttachments: (ctx: AwgpuCtx) => [
                {
                    view: this.target
                        ? this.target.gpuView
                        : ctx.canvasCtx!.getCurrentTexture().createView(),
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
        this.sceneDrawCmp = new SceneDrawCmp(this);
        this.endPassCmp = new EndPass();
    }

    /**
     * Backwards-compatible alias for buildPassCmps.
     */
    buildPassSteps(): void {
        this.buildPassCmps();
    }

    /**
     * Attaches this renderer to a parent Aflow node.
     * Installs RenderPass, SceneDrawCmp, and EndPass into the node's payload array.
     */
    attach(node: Anode<Acmp<AwgpuCtx>[]>): this {
        if (this.parentNode && this.parentNode !== node) {
            this.detach();
        }
        this.parentNode = node;
        this.mountPassCmps();
        return this;
    }

    /**
     * Detaches this renderer from its current parent Aflow node.
     */
    detach(): this {
        if (this.parentNode) {
            this.unmountPassCmps();
            this.parentNode = null;
        }
        return this;
    }

    private mountPassCmps(): void {
        if (!this.parentNode || !this.renderPassCmp || !this.sceneDrawCmp || !this.endPassCmp) return;
        if (!Array.isArray(this.parentNode.data)) {
            this.parentNode.data = [];
        }
        const filtered = this.parentNode.data.filter(
            (c) => c !== this.renderPassCmp && c !== this.sceneDrawCmp && c !== this.endPassCmp
        );
        filtered.push(this.renderPassCmp, this.sceneDrawCmp, this.endPassCmp);
        this.parentNode.data = filtered;
    }

    private mountPassSteps(): void {
        this.mountPassCmps();
    }

    private unmountPassCmps(): void {
        if (!this.parentNode || !Array.isArray(this.parentNode.data)) return;
        this.parentNode.data = this.parentNode.data.filter(
            (c) => c !== this.renderPassCmp && c !== this.sceneDrawCmp && c !== this.endPassCmp
        );
    }

    private unmountPassSteps(): void {
        this.unmountPassCmps();
    }

    /**
     * Sets or clears the active offscreen render target texture.
     * When null, renders to the canvas swapchain view.
     */
    setTarget(target: WgpuTexture | null): this {
        this.target = target;
        this.resizeDepthTexture();
        return this;
    }

    /**
     * Updates depth texture to match target or canvas dimensions.
     */
    resizeDepthTexture(width?: number, height?: number): void {
        const device = this.backend?.device;
        if (!device) return;

        const w = width ?? (this.target ? this.target.width : Math.max(1, this.canvas.width));
        const h = height ?? (this.target ? this.target.height : Math.max(1, this.canvas.height));

        if (this.depthTexture && this.depthTexture.width === w && this.depthTexture.height === h) {
            return;
        }

        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.depthTexture = device.createTexture({
            label: `${this.label}_DepthTexture`,
            size: [w, h, 1],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.depthTextureView = this.depthTexture.createView();
    }

    /**
     * Resize handler to re-allocate depth texture.
     */
    resize(): void {
        this.resizeDepthTexture();
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
        return this.materialBuffers[index];
    }

    /**
     * Acquires or reallocates a dynamic skin storage buffer and bind group.
     */
    private getSkinBuffer(index: number, requiredBytes: number): { buffer: GPUBuffer; bindGroup: GPUBindGroup } {
        const device = this.backend!.device!;
        const size = Math.max(64, requiredBytes);

        if (this.skinBuffers[index] && this.skinBuffers[index].size < size) {
            this.skinBuffers[index].destroy();
            this.skinBuffers[index] = null as any;
        }

        if (!this.skinBuffers[index]) {
            const buffer = device.createBuffer({
                label: `SkinBuffer_${index}`,
                size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const bindGroup = device.createBindGroup({
                label: `SkinBindGroup_${index}`,
                layout: this.skinBindGroupLayout!,
                entries: [{ binding: 0, resource: { buffer } }],
            });
            this.skinBuffers[index] = buffer;
            this.skinBindGroups[index] = bindGroup;
        }

        return { buffer: this.skinBuffers[index], bindGroup: this.skinBindGroups[index] };
    }

    private defaultIdentityPalette: Float32Array | null = null;
    private getDefaultIdentityPalette(jointCount: number): Float32Array {
        const needed = jointCount * 16;
        if (!this.defaultIdentityPalette || this.defaultIdentityPalette.length < needed) {
            const arr = new Float32Array(needed);
            for (let i = 0; i < jointCount; i++) {
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
     * Assembles a Group 2 GPUBindGroup for a GShader with material parameters.
     */
    private getOrCreateShaderBindGroup(
        shader: GShader,
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

        for (let i = 0; i < shader.textureNodes.length; i++) {
            const texNode = shader.textureNodes[i];
            const paramName = texNode.paramName ?? texNode.id;
            const paramVal = paramValues?.[paramName];
            const gTex = (paramVal instanceof GTexture ? paramVal : undefined)
                ?? (texNode.defaultTexture instanceof GTexture ? texNode.defaultTexture : undefined)
                ?? this.defaultGTexture!;

            texKey += `_${gTex.id}`;
            entries.push(
                { binding: 1 + i * 2, resource: gTex.gpuView },
                { binding: 2 + i * 2, resource: gTex.gpuSampler }
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

        // 3. Flat Query: ECS Entities with MeshCmp (holding GMesh)
        for (const [entity, meshCmp] of ecs.query(MeshCmp)) {
            if (!meshCmp.visible) continue;
            const gMesh = meshCmp.rMesh as GMesh;
            if (!gMesh || !gMesh.vertexBuffer || !gMesh.indexBuffer || gMesh.indexCount === 0) continue;

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

            // Directly bind vertex and index buffers from GMesh
            pass.setVertexBuffer(0, gMesh.vertexBuffer);
            pass.setIndexBuffer(gMesh.indexBuffer, gMesh.indexFormat);

            // Iterate through submeshes
            const submeshes = gMesh.submeshes.length > 0
                ? gMesh.submeshes
                : [{ name: "All", indexStart: 0, indexCount: gMesh.indexCount }];

            for (let sIdx = 0; sIdx < submeshes.length; sIdx++) {
                const submesh = submeshes[sIdx];
                if (submesh.visible === false) continue;

                // Shader resolution: MaterialCmp slot sIdx -> MaterialCmp slot 0 -> defaultShader
                const shader = (materialCmp?.shaders[sIdx]
                    ?? materialCmp?.shaders[0]
                    ?? this.defaultShader) as GShader | null | undefined;
                if (!shader) continue;

                // Determine whether skinning should be active for this mesh
                const hasSkin = gMesh.stride === 64 && !!skinCmp;

                const pipeline = shader.getOrCreatePipeline(
                    device,
                    this.backend!.format!,
                    gMesh.stride,
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
                const maxCount = Math.max(0, gMesh.indexCount - submesh.indexStart);
                const safeCount = Math.min(submesh.indexCount, maxCount);
                if (safeCount > 0) {
                    pass.drawIndexed(safeCount, 1, submesh.indexStart, 0, 0);
                    this.drawCallCount++;
                }
            }
        }
    }

    /**
     * Updates an existing GPU texture buffer with latest pixel data from a CPU Texture asset or GTexture.
     */
    updateTexture(texture: GTexture | Texture, maybeCpuTexture?: Texture): void {
        if (!this.backend?.device) return;
        if (texture instanceof GTexture) {
            const cpu = maybeCpuTexture ?? texture.cpuTexture;
            if (cpu) {
                texture.updateFromTexture(this.backend.device, cpu);
            }
        }
    }

    /**
     * Updates active scene and camera state for the upcoming pass.
     */
    setScene(ecs: Aecs, camera: CameraCmp, clearColor?: { r: number; g: number; b: number; a: number }): this {
        this.currentEcs = ecs;
        this.currentCamera = camera;
        if (clearColor) {
            this.clearColor = { ...clearColor };
        }
        if (!this.target) {
            const width = Math.max(1, this.canvas.width);
            const height = Math.max(1, this.canvas.height);
            if (!this.depthTexture || this.depthTexture.width !== width || this.depthTexture.height !== height) {
                this.resizeDepthTexture(width, height);
            }
        }
        return this;
    }

    /**
     * Executes a complete render frame in standalone mode.
     * When orchestrating multiple passes with external Aflow, stage scene state
     * via `setScene(...)` and execute the Aflow DAG instead.
     */
    render(ecs: Aecs, camera: CameraCmp, clearColor?: { r: number; g: number; b: number; a: number }): void {
        this.setScene(ecs, camera, clearColor);
        if (!this.backend?.device) return;

        const ctx = this.backend.newCtx();
        this.standaloneStartCmp.exec(ctx);
        if (this.renderPassCmp) {
            this.renderPassCmp.exec(ctx);
        }
        if (this.sceneDrawCmp) {
            this.sceneDrawCmp.exec(ctx);
        }
        if (this.endPassCmp) {
            this.endPassCmp.exec(ctx);
        }
        this.standaloneEndCmp.exec(ctx);
    }
}
