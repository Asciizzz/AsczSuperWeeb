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

- Allocates a `GPUCommandEncoder` on `ctx.encoder`, resets buffer/bindgroup caches, and sets `ended = false`.

### `EndFrame`
```ts
new EndFrame()
```

- Finishes command recording, submits command buffers to `ctx.queue`, and sets `ended = true`.

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

- **`colorAttachments` / `depthStencilAttachment`**: Accept static attachment descriptors or dynamic callbacks `(ctx) => [...]` to resolve per-frame canvas texture views.

### `ComputePass`
```ts
new ComputePass(data?: ComputePassData)

interface ComputePassData {
    label?: string;
    timestampWrites?: GPUComputePassTimestampWrites;
}
```

- Begins a compute pass via `ctx.encoder.beginComputePass(...)` and sets `ctx.passKind = "compute"`.

### `EndPass`
```ts
new EndPass()
```

- Calls `ctx.pass.end()` and nullifies active pass and pipeline handles on `ctx`.

---

## 3. Pipeline & Binding Components

### `UsePipeline`
```ts
new UsePipeline(pipeline: GPURenderPipeline | GPUComputePipeline | null)
```

- Binds the pipeline via `ctx.pass.setPipeline(pipeline)`.

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

- **`dynamicOffsets`**: Provides dynamic byte offsets for bound uniform or storage buffers.

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
```

- **`vertex`**: Array of slot-indexed vertex buffer descriptors with explicit byte offsets.
- **`index`**: Index buffer entry specifying buffer handle, format (`"uint16"` or `"uint32"`), and byte offset.
- **`indirect`**: Indirect buffer descriptor for GPU-driven draw calls.

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

- Dispatches `ctx.pass.draw(vertexCount, instanceCount, firstVertex, firstInstance)`.

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

- Dispatches `ctx.pass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance)`.

### `DrawIndirect`
```ts
new DrawIndirect(data: DrawIndirectData)

interface DrawIndirectData {
    indirectBuffer?: GPUBuffer | null;
    indirectOffset?: number; // default: 0
}
```

- Dispatches `ctx.pass.drawIndirect(indirectBuffer, indirectOffset)`.

### `DrawIndexedIndirect`
```ts
new DrawIndexedIndirect(data: DrawIndirectData)
```

- Dispatches `ctx.pass.drawIndexedIndirect(indirectBuffer, indirectOffset)`.

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

- Dispatches `ctx.pass.dispatchWorkgroups(x, y, z)`.

### `DispatchIndirect`
```ts
new DispatchIndirect(data: DispatchIndirectData)
```

- Dispatches `ctx.pass.dispatchWorkgroupsIndirect(indirectBuffer, indirectOffset)`.

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
