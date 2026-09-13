# Awgpu

Domain-agnostic WebGPU execution engine managing hardware device presentation, render targets, dynamic buffers, bind group frequency layouts, pipeline compilation, pass recording, and frame sequencing.

---

## Architecture Overview

Awgpu structures GPU workloads across seven core layers:

1. `AwgpuDevice`: Adapter negotiation, GPUDevice lifetime, queue submission, and canvas swapchain configuration.
2. `AwgpuRenderTarget`: Color and depth attachment descriptors supporting screen swapchains, offscreen MRT, depth-only targets, automatic canvas resize synchronization, and cached pass descriptor generation.
3. `AwgpuTexture` & `AwgpuSampler`: Hardware texture views and samplers (filtering and depth comparison).
4. `AwgpuBuffer` & `AwgpuBufferPool`: Aligned uniform, storage, vertex, and index buffers with best-fit pool recycling.
5. `AwgpuBindSlot` & `AwgpuBindGroup`: 4-tier frequency slot organization (`Pass = 0`, `Phase = 1`, `Material = 2`, `Instance = 3`) with dynamic offset support and fluent layout builder.
6. `AwgpuRenderPipeline` & `AwgpuComputePipeline`: Pipeline compilation with automatic vertex stride/offset calculations, structured diagnostic telemetry, and optional fragment stage for depth-only passes.
7. `AwgpuPass` & `AwgpuFrame`: Multi-pass command recording with command pooling, redundant state filtering, imperative recording callbacks, and dynamic offset dispatch.

---

## 1. Device Initialization

```typescript
import { AwgpuDevice } from "./device.js";

// Canvas presentation
const device = await AwgpuDevice.create({
    canvas: "#renderCanvas",
    powerPreference: "high-performance",
});

// Headless device for compute or offscreen testing
const headless = await AwgpuDevice.createHeadless();
```

---

## 2. Render Targets

`AwgpuRenderTarget` configures color attachments and depth-stencil targets. Descriptors are cached internally to eliminate allocation overhead during command recording:

```typescript
import { AwgpuRenderTarget } from "./target.js";

// Canvas presentation target (automatically resizes depth buffer when canvas dimensions change)
const screenTarget = AwgpuRenderTarget.createScreen(device, {
    depthFormat: "depth24plus",
    clearColor: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
});

// Depth-only target for shadow maps
const shadowTarget = AwgpuRenderTarget.createDepthOnly(device.device, 2048, 2048, {
    depthFormat: "depth32float",
});

// Offscreen color + depth target for post-processing or RTT
const offscreenTarget = AwgpuRenderTarget.createOffscreen(device.device, 1920, 1080, {
    colorFormat: "rgba8unorm",
    depthFormat: "depth24plus",
});
```

---

## 3. Buffers and Memory Allocation

`AwgpuBuffer` wraps GPUBuffer with alignment guarantees. `AwgpuBufferPool` recycles buffers across frames using best-fit matching:

```typescript
import { AwgpuBuffer, AwgpuBufferPool } from "./buffer.js";

// Uniform buffer aligned to 16 bytes
const uniformBuf = AwgpuBuffer.createUniform(device.device, new Float32Array(16));

// Vertex buffer aligned to 4 bytes
const vertexBuf = AwgpuBuffer.createVertex(device.device, vertexData);

// Index buffer
const indexBuf = AwgpuBuffer.createIndex(device.device, indexData);

// Dynamic per-frame uniform pool with best-fit reuse
const pool = new AwgpuBufferPool(GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
const frameUniform = pool.acquire(device.device, 64);

// At start of next frame:
pool.reset();
```

---

## 4. Bind Group Layouts and Frequency Slots

`AwgpuBindSlot` organizes bindings across four standard update frequencies:

```typescript
import {
    AwgpuBindSlot,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindGroup,
} from "./layout.js";

// Pass Layout (Slot 0)
const passLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0) // ViewProj matrix
    .build(device.device, "PassLayout");

// Instance Layout with dynamic offset (Slot 3)
const instanceLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0, GPUShaderStage.VERTEX, { hasDynamicOffset: true })
    .build(device.device, "InstanceLayout");

// Material Layout (Slot 2)
const materialLayout = new AwgpuBindGroupLayoutBuilder()
    .addUniform(0) // Material constants
    .addTexture(1) // Base color texture
    .addSampler(2) // Linear sampler
    .build(device.device, "MaterialLayout");

// Instantiate BindGroup
const passBindGroup = AwgpuBindGroup.create(device.device, passLayout, [
    { binding: 0, resource: cameraBuffer },
], { slot: AwgpuBindSlot.Pass });
```

---

## 5. Pipeline Creation

`AwgpuRenderPipeline` compiles shaders and sets primitive, depth, and multisample state. Diagnostic errors route through structured telemetry:

```typescript
import { AwgpuRenderPipeline, createVertexLayout } from "./pipeline.js";

const vertexLayout = createVertexLayout([
    { shaderLocation: 0, format: "float32x3" }, // Position
    { shaderLocation: 1, format: "float32x3" }, // Normal
    { shaderLocation: 2, format: "float32x2" }, // UV
]);

const pipeline = AwgpuRenderPipeline.create(device.device, {
    label: "ForwardLightingPipeline",
    bindGroupLayouts: [passLayout, phaseLayout, materialLayout, instanceLayout],
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
```

Depth-only pipelines omit the fragment stage entirely:

```typescript
const depthPipeline = AwgpuRenderPipeline.create(device.device, {
    label: "ShadowDepthPipeline",
    bindGroupLayouts: [shadowPassLayout, null, null, instanceLayout],
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
```

---

## 6. Pass Recording and Frame Sequencing

`AwgpuPass` records draw commands with state filtering and dynamic uniform offsets:

```typescript
import { AwgpuPass, AwgpuFrame } from "./index.js";

// Pass 1: Depth Shadow Map
const shadowPass = new AwgpuPass("ShadowPass", shadowTarget);
shadowPass.addDraw({
    pipeline: depthPipeline,
    vertexBuffer: meshVbo,
    indexBuffer: meshIbo,
    indexCount: 36,
    bindGroups: [shadowPassBindGroup, null, null, modelBindGroup],
});

// Pass 2: Main Forward Color using command pooling for zero allocations
const mainPass = new AwgpuPass("MainPass", screenTarget);

for (let i = 0; i < objectCount; i++) {
    const draw = mainPass.acquireDraw(); // Reuses pooled command object
    draw.pipeline = pipeline;
    draw.vertexBuffer = meshVbo;
    draw.indexBuffer = meshIbo;
    draw.indexCount = 36;
    draw.bindGroups = [passBindGroup, phaseBindGroup, materialBindGroup, sharedInstanceBindGroup];
    draw.dynamicOffsets = { [AwgpuBindSlot.Instance]: [i * 256] };
}

// Or record imperative hardware commands directly:
const customPass = new AwgpuPass("CustomPass", screenTarget);
customPass.record((passEncoder) => {
    passEncoder.setPipeline(pipeline.gpuPipeline);
    passEncoder.setVertexBuffer(0, meshVbo.gpuBuffer);
    passEncoder.draw(3);
});

// Sequence and submit frame
const frame = new AwgpuFrame();
frame.addPass(shadowPass);
frame.addPass(mainPass);
frame.execute(device);
```
