# WeebGraphic Architecture

## Idea

`WeebGraphic` is a lower-level graphics layer beneath `WeebRender`.

`WeebRender` describes a 3D rendering domain. It knows about cameras, meshes, transforms, materials, skins, shaders, submeshes, and renderable entities.

`WeebGraphic` describes operations and resources common to graphics APIs. It knows about devices, queues, command contexts, buffers, textures, samplers, shader modules, pipelines, bind groups, passes, and draw or dispatch commands.

The boundary is deliberate:

```text
WeebRender
  CameraCmp, MeshCmp, ShaderCmp, SkinCmp, TransformCmp
  renderer queries ECS entities and produces graphics operations

WeebGraphic
  buffers, textures, pipelines, passes, bindings, draws, dispatches
  backend components record operations against a graphics context

WebGPU / WebGL2 / future backends
  native device and command APIs
```

`WeebGraphic` should avoid named 3D concepts. A buffer is a buffer. A texture is a texture. A pipeline is a pipeline. Higher layers decide whether those resources represent a mesh, a shadow map, a particle field, a compute volume, or something else.

## Why It Fits Atoolkit

Atoolkit already contains the pieces needed for this split:

- `Acmp` packages one executable operation as `exec(ctx, diag)`.
- `Adiag` reports structured failures without forcing every backend to throw.
- `Awgpu` provides a mutable GPU context and components for frame, pass, binding, buffer, draw, dispatch, and copy operations.
- `aecs` stores persistent application data in standalone component sets.
- `Acircuit` describes stateless value computation and can supply shader or resource-generation logic.

The main change is naming and ownership. `Awgpu` and `Awgl2` should become backend implementations beneath a shared `WeebGraphic` contract instead of being understood as renderer internals.

## Core Model

### Resources

Resources are sharable handles with lifecycle and backend state.

```typescript
interface GraphicResource<TBackend = unknown> {
    readonly id: number;
    readonly backend: TBackend;
    readonly owned: boolean;
    destroy(): void;
}

interface GraphicBuffer<TBackend = unknown> extends GraphicResource<TBackend> {
    readonly size: number;
    readonly usage: number;
}

interface GraphicTexture<TBackend = unknown> extends GraphicResource<TBackend> {
    readonly width: number;
    readonly height: number;
    readonly format: string;
}
```

The shared layer should define only properties needed for resource identity, lifetime, and binding. WebGPU-specific usage flags, views, storage access, and texture capabilities belong in the WebGPU specialization.

Candidate resources:

- `GraphicBuffer`
- `GraphicTexture`
- `GraphicSampler`
- `GraphicShader`
- `GraphicPipeline`
- `GraphicBindGroup`
- `GraphicSurface`
- `GraphicQuerySet`

A resource may be shared by several systems. For example, a texture can be written by a compute pass, sampled by a render pass, and copied into another texture without being owned by a material object.

### Context

A context is the mutable state passed through an operation sequence.

```typescript
interface GraphicCtx {
    device: GraphicDevice | null;
    queue: GraphicQueue | null;
    encoder: GraphicEncoder | null;
    pass: GraphicPass | null;
    passKind: "render" | "compute" | "copy" | null;
    ended: boolean;
}
```

The context is not the scene and does not contain entities. It represents the current recording session. One frame can create one context and pass it through a flat array of components:

```typescript
const frame: Acmp<GraphicCtx>[] = [
    frameStart,
    updateSimulation,
    beginRenderPass,
    renderer,
    endRenderPass,
    frameEnd,
];

for (const component of frame) {
    component.exec(ctx, diag);
}
```

`FrameStart` and `FrameEnd` remain caller-owned. A graphics engine records its portion of the frame and does not own the complete application lifecycle.

### Operations

Operations are `Acmp` components that mutate the current graphics context or issue commands against the active pass.

```text
FrameStart
  BeginRenderPass or BeginComputePass
    SetPipeline
    SetBindings
    SetBuffers
    Draw or Dispatch
  EndPass
FrameEnd
```

The operation layer should include generic components such as:

- `BeginFrame`
- `EndFrame`
- `BeginRenderPass`
- `BeginComputePass`
- `EndPass`
- `UsePipeline`
- `SetBindGroups`
- `SetBuffers`
- `Draw`
- `DrawIndexed`
- `Dispatch`
- `CopyBufferToBuffer`
- `CopyBufferToTexture`
- `CopyTextureToTexture`

These operations should not know what a mesh, camera, material, or entity is.

## Backend Shape

`WeebGraphic` should define the conceptual contract. Backends provide native implementations.

```text
WeebGraphic
├── GraphicCtx
├── GraphicDevice
├── GraphicResource handles
├── GraphicPass operations
└── Graphic components

WeebGraphic/wgpu
├── WgpuDevice
├── WgpuCtx
├── WgpuBuffer
├── WgpuTexture
├── WgpuPipeline
└── WebGPU Acmp implementations

WeebGraphic/wgl2
├── Wgl2Device
├── Wgl2Ctx
├── Wgl2Buffer
├── Wgl2Texture
├── Wgl2Pipeline
└── WebGL2 Acmp implementations
```

The shared layer must not pretend that all APIs have identical capabilities. It should expose the common contract and let each backend advertise additional features.

## Capability Extensions

WebGPU compute is a good example of a backend capability that should not be forced into `WeebRender`.

```typescript
interface GraphicCapabilities {
    compute: boolean;
    storageBuffers: boolean;
    storageTextures: boolean;
    indirectDraw: boolean;
    timestampQueries: boolean;
}
```

A backend can expose capabilities through its device or context. Higher-level systems can query those capabilities before scheduling operations.

```typescript
if (device.capabilities.compute) {
    frame.push(computePass, computePipeline, dispatch, endComputePass);
}
```

WebGPU-specific extensions can remain available without polluting the lowest common abstraction:

- compute passes
- storage buffers
- storage textures
- indirect drawing
- render bundles
- timestamp queries
- texture views and explicit sampler states

WebGL2 can implement the shared render and resource subset while reporting unsupported capabilities directly.

## WeebRender Above WeebGraphic

`WeebRender` becomes an external 3D engine that translates ECS state into `WeebGraphic` operations.

```text
ECS state
  MeshCmp + TransformCmp + ShaderCmp + SkinCmp
          |
          v
WeebRender
  query entities, resolve assets, select pipelines, record draw operations
          |
          v
WeebGraphic
  begin pass, bind resources, issue indexed draw commands
          |
          v
Backend
  WebGPU or WebGL2 native calls
```

A renderer can own useful 3D policy without owning the graphics context lifecycle:

- query entities containing `MeshCmp`
- resolve `TransformCmp` and `ShaderCmp`
- select a pipeline from shader and vertex layout data
- bind object and shader resources
- issue draw operations
- increment render statistics

It should not own:

- the application frame loop
- physics updates
- hierarchy traversal
- global entity ownership
- the complete command encoder lifecycle
- unrelated compute work

A future particle engine could query `ParticleCmp` and record graphics operations into the same context. A terrain engine could query `TerrainCmp`. A post-processing engine could issue fullscreen draws. They can share resources and frame sequencing without becoming parts of one renderer hierarchy.

## Shared Information

The useful shared information is resource and binding data, not domain names.

Examples:

```typescript
interface BufferBinding {
    buffer: GraphicBuffer;
    offset: number;
    size?: number;
}

interface TextureBinding {
    texture: GraphicTexture;
    view?: GraphicTextureView;
    sampler?: GraphicSampler;
}

interface VertexLayout {
    stride: number;
    attributes: VertexAttributeLayout[];
}

interface VertexAttributeLayout {
    format: string;
    offset: number;
    location: number;
}
```

`WeebRender` can interpret a `VertexLayout` as mesh geometry. A compute engine can interpret a `GraphicBuffer` as a particle storage buffer. `WeebGraphic` only handles the binding and command rules.

## Pipeline Ownership

A pipeline belongs to the layer that understands its inputs.

- `WeebGraphic` owns backend pipeline creation and native pipeline handles.
- `WeebRender` owns the meaning of a 3D shader circuit, vertex layout, camera bindings, and object bindings.
- A compute engine owns compute shader entry points, workgroup sizes, and storage bindings.

This avoids a universal `Material` or `Shader` class that slowly accumulates every possible graphics use case.

A generic pipeline descriptor may look like:

```typescript
interface GraphicPipelineDescriptor {
    vertex?: GraphicShaderStage;
    fragment?: GraphicShaderStage;
    compute?: GraphicShaderStage;
    layout: GraphicPipelineLayout;
    primitive?: GraphicPrimitiveState;
    targets?: GraphicTargetState[];
}
```

The backend validates which combinations it supports. A render pipeline and compute pipeline can share shader modules, buffers, and textures without sharing a domain-level material abstraction.

## Migration Plan

### Phase 1: Name the Boundary

Create `WeebGraphic` as the conceptual package and document the resource, context, operation, and capability layers.

Keep the current `Awgpu` and `Awgl2` implementations working while the boundary stabilizes.

### Phase 2: Extract Common Types

Move or define backend-neutral types for:

- resource identity and ownership
- buffer and texture bindings
- vertex layouts
- pass kinds
- pipeline descriptors
- device capabilities
- frame contexts

Do not force WebGPU and WebGL2 to expose identical native state.

### Phase 3: Move Generic Components

Promote generic operations from `Atoolkit/awgpu/cmps` into the shared graphics layer where their behavior can be expressed across backends:

- pass lifecycle
- pipeline selection
- bind groups or binding sets
- buffers
- draw commands
- copy commands

Keep compute and WebGPU-only operations in the WebGPU backend until another backend can support them meaningfully.

### Phase 4: Rebuild WeebRender on the Lower Layer

Replace renderer-local GPU wrappers with `WeebGraphic` resources, then keep 3D concepts in `WeebRender`:

- `MeshCmp`
- `ShaderCmp`
- `TransformCmp`
- `SkinCmp`
- camera state
- shader graph compilation
- ECS render queries

The renderer should produce or execute a flat list of graphics operations against a caller-provided context.

### Phase 5: Add Compute Consumers

Build a small compute-oriented system as the first non-render consumer:

```text
ComputeSystem
  query ComputeCmp or domain-specific components
  create or reuse GraphicBuffer resources
  record compute pass and dispatch operations
  write results into shared buffers or textures
```

This proves that `WeebGraphic` is genuinely broader than a renamed renderer package.

## Design Rules

1. `WeebGraphic` names resources and operations, not domain objects.
2. `WeebRender` owns 3D interpretation, not the graphics frame lifecycle.
3. Backends expose capabilities instead of hiding unsupported features.
4. ECS stores persistent application state; external engines query and mutate it.
5. `Acmp` components record operations against an explicit context.
6. Frame ownership stays with the caller.
7. Shared resources are handles with explicit lifetime and ownership.
8. Compute, rendering, copying, and presentation may share one context sequence.
9. Backend-neutral abstractions describe real common behavior only.
10. WebGPU-specific power remains available through explicit backend extensions.

## Assessment

This is a strong direction because it gives the repository a real lower layer without forcing every future system to pretend it is a 3D renderer.

The most important risk is designing an abstraction that is too generic to be useful. `WeebGraphic` should not erase meaningful API differences or introduce vague objects such as `UniversalThing` and `GenericPass`. The boundary should stay concrete: resources, bindings, passes, pipelines, command operations, and capabilities.

The proposed split is therefore:

```text
Atoolkit
  reusable execution, data, graph, diagnostic, and math primitives

WeebGraphic
  backend-facing graphics resources and operations

WeebRender
  3D ECS engine built on WeebGraphic

Future engines
  physics, hierarchy, particles, compute, post-processing, and tools
  operating over ECS data and shared graphics resources
```

`WeebRender` becomes one consumer of the graphics layer rather than the definition of graphics itself. That is the useful architectural distinction.
