# Awgpu

WebGPU resource creation helpers and modular execution components.

---

## Core Characteristics

- **Direct WebGPU Access**: Operates directly on buffers, bind groups, pipelines, and passes without scene or material abstractions.
- **Diagnostic Logging**: Operations return null and log structured records to `Adiag` on failure instead of throwing unhandled exceptions.
- **Automatic Buffer Alignment**: Rounds sizes to 4-byte boundaries, auto-unmaps staging buffers, and derives cumulative vertex layout offsets.
- **Atomic Step Execution**: Pass recording, pipeline binding, and draw commands run as atomic `Acmp` steps via `exec(ctx, diag)`.

---

## Quick Start

```ts
import { Adiag } from "../adiag/index.js";
import {
    Backend,
    createBuffer,
    createUniformBuffer,
    createShaderModule,
    createDepthTexture,
    createVertexLayout,
    BeginFrame,
    RenderPass,
    UsePipeline,
    SetBindGroups,
    SetBuffers,
    DrawIndexed,
    EndPass,
    EndFrame,
    type AwgpuCtx,
} from "../awgpu/index.js";

const diag = new Adiag();

// 1. Initialize Backend
const backend = await Backend.create(canvas, {
    format: navigator.gpu.getPreferredCanvasFormat(),
});
const device = backend.device!;

// 2. Allocate Buffers
const vertexBuffer = createBuffer(device, {
    label: "MeshVBO",
    data: new Float32Array([...]),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    diag,
})!;

const indexBuffer = createBuffer(device, {
    label: "MeshIBO",
    data: new Uint16Array([...]),
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    diag,
})!;

const uniformBuffer = createUniformBuffer(device, {
    label: "MeshUniforms",
    size: 128,
    diag,
})!;

// 3. Compile Shaders & Derive Vertex Layout
const shaderModule = createShaderModule(device, {
    label: "MeshShader",
    code: wgslShaderCode,
    validate: true,
    diag,
})!;

const vertexLayout = createVertexLayout([
    { shaderLocation: 0, format: "float32x3" }, // Offset 0,  Size 12
    { shaderLocation: 1, format: "float32x3" }, // Offset 12, Size 12
    { shaderLocation: 2, format: "float32x3" }, // Offset 24, Size 12 -> ArrayStride: 36
]);

// 4. Pipeline & Bind Group
const renderPipeline = device.createRenderPipeline({
    label: "MeshPipeline",
    layout: "auto",
    vertex: { module: shaderModule, entryPoint: "vs_main", buffers: [vertexLayout] },
    fragment: { module: shaderModule, entryPoint: "fs_main", targets: [{ format: backend.format! }] },
    primitive: { topology: "triangle-list", cullMode: "back" },
    depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
});

const bindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
});

let depthTexture = createDepthTexture(device, {
    width: canvas.width,
    height: canvas.height,
    format: "depth24plus",
    diag,
})!;

// 5. Compose Execution Components
const pipeline = [
    new BeginFrame("MainFrame"),
    new RenderPass({
        colorAttachments: (ctx: AwgpuCtx) => [{
            view: ctx.canvasCtx!.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.02, b: 0.03, a: 1.0 },
            loadOp: "clear",
            storeOp: "store",
        }],
        depthStencilAttachment: () => ({
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: "clear",
            depthStoreOp: "store",
        }),
    }),
    new UsePipeline(renderPipeline),
    new SetBindGroups([{ index: 0, bindGroup }]),
    new SetBuffers({
        vertex: [{ slot: 0, buffer: vertexBuffer }],
        index: { buffer: indexBuffer, format: "uint16" },
    }),
    new DrawIndexed({ indexCount: 36 }),
    new EndPass(),
    new EndFrame(),
];

// 6. Frame Loop
function render() {
    backend.queue!.writeBuffer(uniformBuffer, 0, mvpMatrixData);
    const ctx = backend.newCtx();
    for (let i = 0; i < pipeline.length; i++) {
        pipeline[i].exec(ctx, diag);
    }
    requestAnimationFrame(render);
}
render();
```

---

## Utilities

### `createBuffer(device, options)`
Allocates `GPUBuffer` with automatic 4-byte alignment, deriving byte sizes from `data` when provided.

```ts
const vbo = createBuffer(device, {
    label: "PositionsVBO",
    data: new Float32Array([...]),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    diag,
});
```

### `createUniformBuffer(device, options)`
Helper creating buffer with default usage `UNIFORM | COPY_DST`.

### `createShaderModule(device, options)`
Compiles WGSL code. When `validate: true` and `diag` is supplied, checks `getCompilationInfo()` and records compiler warnings/errors.

### `createDepthTexture(device, options)`
Allocates depth texture with default format `"depth24plus"` and usage `RENDER_ATTACHMENT`.

### `createTexture2D(device, options)`
Allocates 2D `GPUTexture` with customizable dimensions, format, and usage flags.

### `createVertexLayout(attributes, stepMode?)`
Calculates cumulative byte offsets and 4-byte aligned strides across attributes, returning a `GPUVertexBufferLayout`:

```ts
const layout = createVertexLayout([
    { shaderLocation: 0, format: "float32x3" }, // offset: 0,  size: 12
    { shaderLocation: 1, format: "float32x2" }, // offset: 12, size: 8
    { shaderLocation: 2, format: "unorm8x4" },  // offset: 20, size: 4 -> stride: 24
]);
```

---

## Context & Backend

### `AwgpuCtx`
Mutable object created per frame by `backend.newCtx()` and passed through every step:

```ts
interface AwgpuCtx {
    device:     GPUDevice | null;
    queue:      GPUQueue | null;
    canvas:     HTMLCanvasElement | null;
    canvasCtx:  GPUCanvasContext | null;
    format:     GPUTextureFormat | null;

    encoder:    GPUCommandEncoder | null;
    pass:       GPURenderPassEncoder | GPUComputePassEncoder | null;
    passKind:   "render" | "compute" | null;
    pipeline:   GPURenderPipeline | GPUComputePipeline | null;

    buffers: {
        vertex:   Map<number, AwgpuVertexBufferEntry>;
        index:    AwgpuIndexBufferEntry | null;
        indirect: AwgpuIndirectBufferEntry | null;
    };

    bindGroups: Map<number, AwgpuBindGroupEntry>;
    textures:   Map<number, unknown>;
    ended:      boolean;
}
```

### `Backend`
Handles adapter and device requests, canvas configuration, and frame context allocation:

- `Backend.create(canvas, options)`: Asynchronous factory.
- `backend.init()`: Requests adapter/device and configures canvas.
- `backend.currentView()`: Returns `canvasCtx.getCurrentTexture().createView()`.
- `backend.createEncoder(label?)`: Allocates new `GPUCommandEncoder`.
- `backend.submit(encoderOrCommands)`: Submits commands to device queue.
- `backend.newCtx()`: Allocates fresh `AwgpuCtx`.
- `backend.destroy()`: Cleans up context configuration and device handles.

---

## Step Components

Detailed signatures for step classes are documented in **[`steps/ReadMe.md`](./steps/ReadMe.md)**:

- **Lifecycle**: `BeginFrame`, `EndFrame`
- **Passes**: `RenderPass`, `ComputePass`, `EndPass`
- **Pipelines and Bindings**: `UsePipeline`, `SetBindGroups`
- **Buffers**: `SetBuffers` (Vertex slots, index buffer, indirect buffer)
- **Draw Commands**: `Draw`, `DrawIndexed`, `DrawIndirect`, `DrawIndexedIndirect`
- **Compute**: `Dispatch`, `DispatchIndirect`
- **Memory Copy**: `CopyBufferToBuffer`, `CopyBufferToTexture`, `CopyTextureToBuffer`, `CopyTextureToTexture`