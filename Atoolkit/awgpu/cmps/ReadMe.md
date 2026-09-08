# Execution Components

WebGPU component classes for `Atoolkit/awgpu`, extending `Acmp<AwgpuCtx>` to execute against mutable frame contexts:

---

## Execution Model

Every component executes directly against the frame context:

```ts
cmp.exec(ctx, diag);
```

- `ctx`: Mutable `AwgpuCtx` created per frame by `backend.newCtx()`.
- `diag`: Optional `Adiag` collector for errors and telemetry.

---

## 1. Frame Lifecycle Components

### `BeginFrame`
```ts
new BeginFrame(label?: string)
```
- Action: Allocates `GPUCommandEncoder` on `ctx.encoder`, resets buffer/bindgroup/texture caches, and sets `ended = false`.

### `EndFrame`
```ts
new EndFrame()
```
- Action: Finishes encoder, submits to `ctx.queue`, and sets `ended = true`.

---

## 2. Pass Components

### `RenderPass`
```ts
new RenderPass(data?: RenderPassData)

interface RenderPassData {
    label?: string;
    colorAttachments?: (GPURenderPassColorAttachment | null)[] | ((ctx: AwgpuCtx) => (GPURenderPassColorAttachment | null)[]);
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment | undefined | ((ctx: AwgpuCtx) => GPURenderPassDepthStencilAttachment | undefined);
}
```
- Action: Begins render pass via `ctx.encoder.beginRenderPass(...)` and sets `ctx.passKind = "render"`.
- Dynamic Views: `colorAttachments` and `depthStencilAttachment` accept callbacks `(ctx) => [...]` for per-frame canvas views.

### `ComputePass`
```ts
new ComputePass(data?: ComputePassData)

interface ComputePassData {
    label?: string;
    timestampWrites?: GPUComputePassTimestampWrites;
}
```
- Action: Begins compute pass via `ctx.encoder.beginComputePass(...)` and sets `ctx.passKind = "compute"`.

### `EndPass`
```ts
new EndPass()
```
- Action: Calls `ctx.pass.end()` and nullifies pass/pipeline handles.

---

## 3. Pipeline & Binding Components

### `UsePipeline`
```ts
new UsePipeline(pipeline: GPURenderPipeline | GPUComputePipeline | null)
```
- Action: Binds pipeline via `ctx.pass.setPipeline(pipeline)`.

### `SetBindGroups`
```ts
new SetBindGroups(bindGroups: BindGroupEntry[])

interface BindGroupEntry {
    index:                    number;
    bindGroup:                GPUBindGroup;
    dynamicOffsets?:          Iterable<number>;
    dynamicOffsetsData?:      Uint32Array;
    dynamicOffsetsDataStart?: number;
    dynamicOffsetsDataLength?: number;
}
```
- Action: Iterates entries and invokes `ctx.pass.setBindGroup(entry.index, entry.bindGroup, ...)`.

---

## 4. Buffer Components

### `SetBuffers`
```ts
new SetBuffers(data: SetBuffersData)

interface SetBuffersData {
    vertex?:   VertexBufferEntry[];
    index?:    IndexBufferEntry | null;
    indirect?: IndirectBufferEntry | null;
}

interface VertexBufferEntry {
    slot:    number;
    buffer:  GPUBuffer;
    offset?: number; // default: 0
    size?:   number;
}

interface IndexBufferEntry {
    buffer:  GPUBuffer;
    format:  GPUIndexFormat; // "uint16" | "uint32"
    offset?: number; // default: 0
    size?:   number;
}

interface IndirectBufferEntry {
    buffer:  GPUBuffer;
    offset?: number;
}
```
- Action: Binds vertex buffers to slots and attaches index buffer on `ctx.pass`.

---

## 5. Draw Commands

### `Draw`
```ts
new Draw(data: DrawData)

interface DrawData {
    vertexCount:    number;
    instanceCount?: number; // default: 1
    firstVertex?:   number; // default: 0
    firstInstance?: number; // default: 0
}
```
- Action: Dispatches `ctx.pass.draw(vertexCount, instanceCount, firstVertex, firstInstance)`.

### `DrawIndexed`
```ts
new DrawIndexed(data: DrawIndexedData)

interface DrawIndexedData {
    indexCount:     number;
    instanceCount?: number; // default: 1
    firstIndex?:    number; // default: 0
    baseVertex?:    number; // default: 0
    firstInstance?: number; // default: 0
}
```
- Action: Dispatches `ctx.pass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance)`.

### `DrawIndirect`
```ts
new DrawIndirect(data: DrawIndirectData)

interface DrawIndirectData {
    indirectBuffer?: GPUBuffer | null;
    indirectOffset?: number; // default: 0
}
```
- Action: Dispatches `ctx.pass.drawIndirect(indirectBuffer, indirectOffset)`.

### `DrawIndexedIndirect`
```ts
new DrawIndexedIndirect(data: DrawIndirectData)
```
- Action: Dispatches `ctx.pass.drawIndexedIndirect(indirectBuffer, indirectOffset)`.

---

## 6. Compute Commands

### `Dispatch`
```ts
new Dispatch(data: DispatchData)

interface DispatchData {
    workgroupCountX:  number;
    workgroupCountY?: number; // default: 1
    workgroupCountZ?: number; // default: 1
}
```
- Action: Dispatches `ctx.pass.dispatchWorkgroups(x, y, z)`.

### `DispatchIndirect`
```ts
new DispatchIndirect(data: DispatchIndirectData)
```
- Action: Dispatches `ctx.pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset)`.

---

## 7. Memory Copy Components

| Component Class | Constructor | Command |
| :--- | :--- | :--- |
| `CopyBufferToBuffer` | `(source, sourceOffset, destination, destinationOffset, size)` | `ctx.encoder.copyBufferToBuffer(...)` |
| `CopyBufferToTexture` | `(source, destination, copySize)` | `ctx.encoder.copyBufferToTexture(...)` |
| `CopyTextureToBuffer` | `(source, destination, copySize)` | `ctx.encoder.copyTextureToBuffer(...)` |
| `CopyTextureToTexture` | `(source, destination, copySize)` | `ctx.encoder.copyTextureToTexture(...)` |

---

## Execution Rules

1. **State Persistence**: Pipelines, bind groups, and buffers bound to `ctx` remain active for subsequent components until overwritten.
2. **Pass Scoping**: Every `RenderPass` or `ComputePass` must conclude with an `EndPass` before starting another pass.
