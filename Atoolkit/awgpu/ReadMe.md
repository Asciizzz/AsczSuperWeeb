# Awgpu

Domain-agnostic WebGPU execution engine managing hardware device presentation, render targets, dynamic buffers, bind group frequency layouts, pipeline compilation, pass recording, and frame sequencing.

---

## Architecture Overview

Awgpu structures GPU workloads across seven layers:

1. `AwgpuDevice`: Adapter negotiation, GPUDevice lifetime, queue submission, and canvas swapchain configuration.
2. `AwgpuRenderTarget`: Color and depth attachment descriptors supporting screen swapchains, offscreen MRT, depth-only targets, automatic canvas resize synchronization, and cached pass descriptor generation.
3. `AwgpuTexture` & `AwgpuSampler`: Hardware texture views and samplers (filtering and depth comparison).
4. `AwgpuBuffer` & `AwgpuBufferPool`: Aligned uniform, storage, vertex, and index buffers with best-fit pool recycling.
5. `AwgpuBindSlot` & `AwgpuBindGroup`: 4-tier frequency slot organization (`Pass = 0`, `Phase = 1`, `Material = 2`, `Instance = 3`) with dynamic offset support and fluent layout builder.
6. `AwgpuRenderPipeline` & `AwgpuComputePipeline`: Pipeline compilation with automatic vertex stride/offset calculations, structured diagnostic telemetry, and optional fragment stage for depth-only passes.
7. `AwgpuPass` & `AwgpuFrame`: Multi-pass command recording with command pooling, redundant state filtering, imperative recording callbacks, and dynamic offset dispatch.

---

## 1. Device Management

`AwgpuDevice` manages adapter selection, logical device acquisition, command submission, and presentation swapchains.

```typescript
import { AwgpuDevice } from "./device.js";

// Canvas presentation initialization
const device = await AwgpuDevice.create({
    canvas: "#renderCanvas",
    powerPreference: "high-performance",
    alphaMode: "premultiplied",
});

// Headless device initialization for compute or offscreen testing
const headless = await AwgpuDevice.createHeadless({
    powerPreference: "high-performance",
});
```

- `AwgpuDevice.create(options)`: Requests `GPUAdapter` matching `powerPreference` (defaults to `"high-performance"`), acquires `GPUDevice`, resolves target canvas from selector string or element reference, and configures swapchain format via `navigator.gpu.getPreferredCanvasFormat()`.
- `AwgpuDevice.createHeadless(options)`: Initializes device with `canvas: null` for compute pipelines, test harnesses, or worker threads.
- `createScreenTarget(options)`: Allocates `AwgpuRenderTarget` bound to canvas swapchain with matching dimensions and optional depth attachment.
- `createCommandEncoder(label)`: Instantiates fresh `GPUCommandEncoder`.
- `submit(commands)`: Accepts single instance or array of `GPUCommandBuffer` or `GPUCommandEncoder`. Automatically calls `finish()` on encoders before submitting to hardware queue.
- `destroy()`: Unconfigures canvas presentation context and destroys underlying `GPUDevice`.

---

## 2. Textures, Samplers, and Render Targets

`AwgpuTexture` and `AwgpuSampler` wrap hardware resources. `AwgpuRenderTarget` coordinates color and depth attachments for pass recording.

```typescript
import { AwgpuTexture, AwgpuSampler, AwgpuRenderTarget } from "./target.js";

// Textures
const colorTex = AwgpuTexture.create2D(device.device, {
    width: 1920,
    height: 1080,
    format: "rgba8unorm",
});

const depthTex = AwgpuTexture.createDepth(device.device, {
    width: 2048,
    height: 2048,
    format: "depth32float",
});

// Samplers
const linearSampler = AwgpuSampler.createLinear(device.device);
const shadowSampler = AwgpuSampler.createComparison(device.device, { compare: "less" });

// Targets
const screenTarget = AwgpuRenderTarget.createScreen(device, {
    depthFormat: "depth24plus",
    clearColor: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
});

const shadowTarget = AwgpuRenderTarget.createDepthOnly(device.device, 2048, 2048, {
    depthFormat: "depth32float",
});

const offscreenTarget = AwgpuRenderTarget.createOffscreen(device.device, 1920, 1080, {
    colorFormat: "rgba8unorm",
    depthFormat: "depth24plus",
});
```

- `AwgpuTexture.create2D(device, options)`: Allocates 2D texture and companion view with default `TEXTURE_BINDING | RENDER_ATTACHMENT | COPY_DST` usage.
- `AwgpuTexture.createDepth(device, options)`: Allocates depth or depth-stencil texture with `RENDER_ATTACHMENT | TEXTURE_BINDING` usage.
- `AwgpuTexture.fromTexture(gpuTexture, options)`: Wraps pre-existing hardware texture without taking destruction ownership unless `gpuOwned: true` is specified.
- `AwgpuSampler.createLinear(device, label)`: Bilinear/trilinear filtering sampler with repeat address mode.
- `AwgpuSampler.createNearest(device, label)`: Point filtering sampler with clamp-to-edge address mode.
- `AwgpuSampler.createComparison(device, options)`: Hardware comparison sampler configured for depth tests and shadow percentage-closer filtering.
- `AwgpuRenderTarget.createScreen(gfx, options)`: Binds color attachment 0 to canvas swapchain backbuffer. Automatically updates dimensions and allocates depth texture when requested.
- `AwgpuRenderTarget.createDepthOnly(device, width, height, options)`: Allocates pure depth destination omitting color attachments, intended for shadow map generation and depth prepasses.
- `AwgpuRenderTarget.createOffscreen(device, width, height, options)`: Allocates offscreen color texture and depth attachment for render-to-texture and post-processing passes.
- `resize(device, width, height)`: Reallocates internal color and depth textures when target dimensions change, marking cached pass descriptors dirty.
- `buildPassDescriptor(options)`: Generates `GPURenderPassDescriptor`. Automatically checks canvas dimensions on screen targets, resizing attachments if canvas width/height changed. Caches descriptor structure to eliminate per-frame object allocation, updating only dynamic fields (swapchain views, clear colors, load operations).
- `invalidateDescriptor()`: Forces cached descriptor rebuild on subsequent pass executions.

---

## 3. Buffers and Memory Pooling

`AwgpuBuffer` manages aligned GPU storage. `AwgpuBufferPool` provides dynamic per-frame allocation with best-fit buffer recycling.

```typescript
import { AwgpuBuffer, AwgpuBufferPool } from "./buffer.js";

// Explicit buffers
const uniformBuf = AwgpuBuffer.createUniform(device.device, new Float32Array(16));
const vertexBuf  = AwgpuBuffer.createVertex(device.device, vertexFloatArray);
const indexBuf   = AwgpuBuffer.createIndex(device.device, indexUint16Array);
const storageBuf = AwgpuBuffer.createStorage(device.device, 1024, { readOnly: false });

// Buffer updates
uniformBuf.write(device.device, updatedFloatArray);

// Per-frame buffer pool
const pool = new AwgpuBufferPool(GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
const frameUniform = pool.acquire(device.device, 64);
frameUniform.write(device.device, modelMatrixData);

// Frame boundary reset
pool.reset();
```

- `AwgpuBuffer.createUniform(device, sizeOrData, label)`: Enforces 16-byte minimum sizing and 16-byte alignment required by WebGPU uniform buffer specifications.
- `AwgpuBuffer.createVertex(device, dataOrSize, label)`: Allocates vertex buffer aligned to 4 bytes with `VERTEX | COPY_DST` usage.
- `AwgpuBuffer.createIndex(device, dataOrSize, label)`: Allocates index buffer aligned to 4 bytes with `INDEX | COPY_DST` usage.
- `AwgpuBuffer.createStorage(device, sizeOrData, options)`: Allocates storage buffer aligned to 4 bytes with `STORAGE | COPY_DST` usage.
- `write(device, data, bufferOffset)`: Uploads typed array data into buffer memory via `queue.writeBuffer`.
- `AwgpuBufferPool.acquire(device, requiredSize)`: Searches available idle buffers using best-fit matching for smallest capacity satisfying `requiredSize` (aligned to 16 bytes). Reuses existing buffers without driver destruction; allocates new buffer only when no available buffer fits.
- `AwgpuBufferPool.release(buffer)`: Returns individual buffer back to available pool ahead of frame reset.
- `AwgpuBufferPool.reset()`: Moves all active buffers from in-use pool back into available pool for subsequent frame recycling without deallocating memory.
- `totalBuffers` / `inUseCount`: Inspects pool allocation counts for memory profiling.

---

## 4. Bind Group Layouts and Frequency Slots

`AwgpuBindSlot` organizes bindings across four standard update frequencies. `AwgpuBindGroupLayoutBuilder` constructs layouts with dynamic offset support.

```typescript
import {
    AwgpuBindSlot,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindGroup,
} from "./layout.js";

// Pass Layout (Slot 0): Camera view-projection
const passLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT)
    .build(device.device, "PassLayout");

// Material Layout (Slot 2): Surface constants and textures
const materialLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0, GPUShaderStage.FRAGMENT)
    .addTexture(1, GPUShaderStage.FRAGMENT)
    .addSampler(2, GPUShaderStage.FRAGMENT)
    .build(device.device, "MaterialLayout");

// Instance Layout (Slot 3): Model transforms with dynamic uniform buffer offsets
const instanceLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0, GPUShaderStage.VERTEX, { hasDynamicOffset: true })
    .build(device.device, "InstanceLayout");

// BindGroup instantiation
const passBindGroup = AwgpuBindGroup.create(device.device, passLayout, [
    { binding: 0, resource: cameraBuffer },
], { slot: AwgpuBindSlot.Pass });
```

- `AwgpuBindSlot`: Standardized binding frequency slots:
  - `Pass = 0`: View-projection matrices, viewport size, global frame constants.
  - `Phase = 1`: Environment maps, lighting clusters, phase-specific buffers.
  - `Material = 2`: Diffuse/normal textures, surface properties, samplers.
  - `Instance = 3`: Per-instance transforms, bone palettes, dynamic model data.
- `AwgpuBindGroupLayoutBuilder.addUniform(binding, visibility, options)`: Appends uniform buffer entry. `options.hasDynamicOffset` enables WebGPU dynamic offset binding; `options.minBindingSize` enforces minimum buffer validation size.
- `AwgpuBindGroupLayoutBuilder.addStorage(binding, visibility, options)`: Appends storage buffer entry (`read-only-storage` or `storage`). Supports `hasDynamicOffset`.
- `AwgpuBindGroupLayoutBuilder.addTexture(binding, visibility, options)`: Appends texture entry (`float`, `unfilterable-float`, `sint`, `uint`, `depth`).
- `AwgpuBindGroupLayoutBuilder.addSampler(binding, visibility, options)`: Appends sampler entry (`filtering`, `non-filtering`, or `comparison`).
- `AwgpuBindGroup.create(device, layout, entries, options)`: Resolves toolkit resource wrappers (`AwgpuBuffer`, `AwgpuTexture`, `AwgpuSampler`) into native `GPUBindingResource` descriptors, tracks assigned slot index, and instantiates `GPUBindGroup`.

---

## 5. Pipeline Creation and Diagnostics

`createVertexLayout` derives vertex strides and offsets automatically. `AwgpuRenderPipeline` and `AwgpuComputePipeline` compile shader modules with structured diagnostic reporting.

```typescript
import {
    createVertexLayout,
    AwgpuRenderPipeline,
    AwgpuComputePipeline,
} from "./pipeline.js";

// Automated vertex layout derivation
const vertexLayout = createVertexLayout([
    { shaderLocation: 0, format: "float32x3" }, // Position: offset 0
    { shaderLocation: 1, format: "float32x3" }, // Normal:   offset 12
    { shaderLocation: 2, format: "float32x2" }, // UV:       offset 24
]); // arrayStride = 32

// Full render pipeline
const pipeline = AwgpuRenderPipeline.create(device.device, {
    label: "ForwardPipeline",
    bindGroupLayouts: [passLayout, null, materialLayout, instanceLayout],
    vertex: {
        code: shaderCode,
        entryPoint: "vs_main",
        buffers: [vertexLayout],
    },
    fragment: {
        code: shaderCode,
        entryPoint: "fs_main",
        targets: [{ format: device.format }],
    },
    depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
    },
    diag: diagnosticCollector, // Optional diagnostic logger receiving structured compilation records
});

// Depth-only pipeline (omits fragment stage)
const shadowPipeline = AwgpuRenderPipeline.create(device.device, {
    label: "ShadowPipeline",
    bindGroupLayouts: [passLayout, null, null, instanceLayout],
    vertex: {
        code: shadowShaderCode,
        buffers: [vertexLayout],
    },
    depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
    },
});

// Compute pipeline
const computePipeline = AwgpuComputePipeline.create(device.device, {
    label: "ParticleComputePipeline",
    code: computeShaderCode,
    bindGroupLayouts: [computeBindGroupLayout],
});
```

- `createVertexLayout(attributes, stepMode)`: Computes cumulative byte offsets and aligns `arrayStride` to 4-byte boundaries automatically from format strings.
- `AwgpuRenderPipeline.create(device, descriptor)`: Compiles vertex shader and optional fragment shader modules. Fills omitted intermediate bind group layout slots with empty layouts, preventing layout index misalignment.
- Depth-only execution: Omitting `descriptor.fragment` instantiates a pure depth pipeline (for shadow mapping or occlusion prepasses) without fragment shader overhead.
- Structured diagnostics: `descriptor.diag` accepts any logger implementing `err`, `warn`, or `info`. Shader compilation warnings and errors route into structured records containing stage name, line numbers, character positions, and error text. `descriptor.onShaderMessage` provides direct per-message callback hooks.
- `AwgpuComputePipeline.create(device, options)`: Compiles compute shader module and creates `GPUComputePipeline` with matching diagnostic routing.

---

## 6. Pass Recording and Frame Sequencing

`AwgpuPass` records draw commands with state filtering and dynamic offsets. `AwgpuFrame` orchestrates multi-pass command buffer submission.

```typescript
import { AwgpuPass, AwgpuFrame, AwgpuBindSlot } from "./index.js";

// Shadow depth pass
const shadowPass = new AwgpuPass("ShadowPass", shadowTarget);
shadowPass.addDraw({
    pipeline: shadowPipeline,
    vertexBuffer: meshVbo,
    indexBuffer: meshIbo,
    indexCount: 36,
    bindGroups: [shadowPassBindGroup, null, null, instanceBindGroup],
    dynamicOffsets: { [AwgpuBindSlot.Instance]: [0] },
});

// Main color pass using pooled commands for zero heap allocations
const mainPass = new AwgpuPass("MainPass", screenTarget);

for (let i = 0; i < objectCount; i++) {
    const draw = mainPass.acquireDraw(); // Recycles pre-allocated command struct
    draw.pipeline = pipeline;
    draw.vertexBuffer = meshVbo;
    draw.indexBuffer = meshIbo;
    draw.indexCount = 36;
    draw.bindGroups = [passBindGroup, null, materialBindGroup, sharedDynamicBindGroup];
    draw.dynamicOffsets = { [AwgpuBindSlot.Instance]: [i * 256] };
}

// Direct hardware recording bypass
const postPass = new AwgpuPass("PostPass", screenTarget);
postPass.record((passEncoder) => {
    passEncoder.setPipeline(postPipeline.gpuPipeline);
    passEncoder.setBindGroup(0, postBindGroup.gpuBindGroup);
    passEncoder.draw(3);
});

// Sequence and submit frame
const frame = new AwgpuFrame();
frame.addPass(shadowPass);
frame.addPass(mainPass);
frame.addPass(postPass);
frame.execute(device);
```

- `AwgpuPass.addDraw(cmd)`: Enqueues draw command into pass list.
- `AwgpuPass.acquireDraw()`: Returns recycled `AwgpuDrawCommand` from internal command pool, resetting mutable fields. Reused instances populate `drawCommands` without per-frame object allocation.
- `AwgpuPass.record(recorder)`: Registers custom imperative callback receiving raw `GPURenderPassEncoder`, bypassing command list processing.
- `AwgpuPass.clearDraws()`: Empties `drawCommands` and resets pool index to 0 for subsequent frame reuse.
- `AwgpuPass.execute(encoder, customRecorder?)`: Opens pass using target's cached descriptor. Applies viewport/scissor. When executing queued draws, filters redundant GPU state changes (skips re-binding identical pipelines, vertex buffers, index buffers, and static bind groups). Dispatches dynamic uniform offsets whenever provided.
- `AwgpuComputePass.acquireCompute()` / `record(recorder)`: Recycles compute command objects and supports direct compute pass dispatch.
- `AwgpuFrame.addPass(pass)`: Sequences render and compute passes.
- `AwgpuFrame.execute(deviceOrGfx, label)`: Allocates single `GPUCommandEncoder`, executes all passes sequentially, finishes command recording, and submits final `GPUCommandBuffer` to device queue.
