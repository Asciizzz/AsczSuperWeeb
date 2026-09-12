# Awgpu

Domain-agnostic WebGPU execution engine managing hardware device presentation, render targets, dynamic buffers, bind group frequency layouts, pipeline compilation, pass recording, and frame sequencing.

---

## Architecture Overview

Awgpu structures GPU workloads across seven core layers:

1. **`AwgpuDevice`**: Adapter negotiation, GPUDevice lifetime, queue submission, and canvas swapchain configuration.
2. **`AwgpuRenderTarget`**: Color and depth attachment descriptors supporting screen swapchains, offscreen MRT, and depth-only targets.
3. **`AwgpuTexture` & `AwgpuSampler`**: Hardware texture views and samplers (filtering and depth comparison).
4. **`AwgpuBuffer` & `AwgpuBufferPool`**: Aligned uniform, storage, vertex, and index buffers with per-frame pool recycling.
5. **`AwgpuBindSlot` & `AwgpuBindGroup`**: 4-tier frequency slot organization (`Pass = 0`, `Phase = 1`, `Material = 2`, `Instance = 3`) with fluent layout builder.
6. **`AwgpuRenderPipeline` & `AwgpuComputePipeline`**: Pipeline compilation with automatic vertex stride/offset calculations and optional fragment stage for depth-only passes.
7. **`AwgpuPass` & `AwgpuFrame`**: Multi-pass command recording with redundant pipeline/bind group state filtering.

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

`AwgpuRenderTarget` configures color attachments and depth-stencil targets:

```typescript
import { AwgpuRenderTarget } from "./target.js";

// Canvas presentation target
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

`AwgpuBuffer` wraps GPUBuffer with alignment guarantees:

```typescript
import { AwgpuBuffer, AwgpuBufferPool } from "./buffer.js";

// Uniform buffer aligned to 16 bytes
const uniformBuf = AwgpuBuffer.createUniform(device.device, new Float32Array(16));

// Vertex buffer aligned to 4 bytes
const vertexBuf = AwgpuBuffer.createVertex(device.device, vertexData);

// Index buffer
const indexBuf = AwgpuBuffer.createIndex(device.device, indexData);

// Dynamic per-frame uniform pool
const pool = new AwgpuBufferPool(GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
const frameUniform = pool.acquire(device.device, 64);
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

`AwgpuRenderPipeline` compiles shaders and sets primitive, depth, and multisample state:

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

`AwgpuPass` records draw commands with automatic state filtering:

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

// Pass 2: Main Forward Color
const mainPass = new AwgpuPass("MainPass", screenTarget);
mainPass.addDraw({
    pipeline,
    vertexBuffer: meshVbo,
    indexBuffer: meshIbo,
    indexCount: 36,
    bindGroups: [passBindGroup, phaseBindGroup, materialBindGroup, modelBindGroup],
});

// Sequence and submit frame
const frame = new AwgpuFrame();
frame.addPass(shadowPass);
frame.addPass(mainPass);
frame.execute(device);
```
