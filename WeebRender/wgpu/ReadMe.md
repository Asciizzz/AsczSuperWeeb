# WebGPU Backend (WeebRender/wgpu)

WebGPU hardware implementation for `WeebRender`, managing GPU buffers, pipelines, textures, and Aflow pass recording.

---

## Modules

### `wmesh.ts`

`WgpuMesh` specializes `GpuMesh<WgpuMeshPayload>`:
- Exposes typed getters for `vertexBuffer` (`GPUBuffer`), `indexBuffer` (`GPUBuffer`), and `indexFormat` (`GPUIndexFormat`).
- Guarantees 4-byte multiple buffer sizes (`Math.ceil(size / 4) * 4`) and uses `writeBufferPadded` to prevent WebGPU DOMExceptions on odd-length index buffers.
- Supports factory allocation via `WgpuMesh.fromMesh(device, mesh)` and non-owning reference wrapping via `WgpuMesh.ref(vertexBuffer, indexBuffer, options)`.
- Dynamically resizes GPU buffers on `updateFromMesh(device, mesh)` when incoming data exceeds existing buffer size.

### `wtexture.ts`

`WgpuTexture` specializes `GpuTexture<WgpuTexturePayload>`:
- Exposes typed getters for `gpuTexture` (`GPUTexture`), `gpuView` (`GPUTextureView`), and `gpuSampler` (`GPUSampler`).
- Uploads raw pixel data via `WgpuTexture.fromTexture(device, texture)`.
- Wraps existing GPU texture handles for offscreen Render-to-Texture (RTT) targets via `WgpuTexture.ref(texture, options)`.
- Supports manual resource release via `destroy()`.

### `wshader.ts`

`WgpuShader` specializes `GpuShader<WgpuShaderPayload>`:
- Constructor accepts either a `CompiledShaderBlueprint` or an uncompiled `ShaderGraph`.
- Caches compiled `GPURenderPipeline` instances by vertex stride and skinning state (`32_static` vs `64_skinned`).
- Manages `materialBindGroupLayout` (Group 2) and `skinBindGroupLayout` (Group 3).
- Supports runtime pipeline hot-reloading via `invalidateGpu()`.

### `wgsl.ts`

Dedicated WebGPU shader code compiler:
- `compileWgsl(graph, options)`: Traverses `ShaderGraph` AST nodes, validates parameter uniqueness, builds memory layouts, and generates WGSL vertex and fragment programs.
- Emits WGSL code for both static (stride 32) and skinned (stride 64) vertex paths in a single blueprint.
- Automatically registers as `ShaderGraph.defaultCompiler` when `wgpu` is imported.

### `renderer.ts`

`WgpuRenderer`:
- Initializes `Awgpu` device context, swapchain format, depth-stencil buffer, and default 1x1 white fallback texture.
- Assembles the `Aflow` render execution graph (`BeginFrame` -> `RenderPass` -> `EndFrame`).
- Maintains object uniform buffer pools (Group 1, 64 bytes) and material uniform buffer pools (Group 2).
- Queries renderable ECS entities and dispatches draw calls inside `executeDrawCalls`.

---

## Bind Group Layout Specifications

The WebGPU backend organizes shader resources into 4 sequential bind groups:

| Group | Binding | Type | Resource | Size / Description |
| :--- | :--- | :--- | :--- | :--- |
| **0** | `0` | Uniform Buffer | `uCamera` | 80 bytes (16 floats `viewProj` matrix + 4 floats `cameraPos`) |
| **1** | `0` | Uniform Buffer | `uObject` | 64 bytes (16 floats `model` matrix) |
| **2** | `0` | Uniform Buffer | `uMaterial` | Aligned to 16 bytes. Holds parameter values declared by graph nodes |
| **2** | `1 + 2*i` | Texture View | `t_tex_i` | 2D float texture resource for sample node `i` |
| **2** | `2 + 2*i` | Sampler | `s_tex_i` | Filtering sampler for sample node `i` |
| **3** | `0` | Storage Buffer (read) | `uBones` | Dynamic array of 4x4 matrix transforms for skeletal skinning |

---

## Stride Modes

`WgpuShader` automatically adapts to two standard vertex strides:

### Static Mesh (Stride 32 Bytes)
- Attribute 0: `position` (`Float32x3`, offset 0)
- Attribute 1: `normal` (`Float32x3`, offset 12)
- Attribute 2: `uv` (`Float32x2`, offset 24)
- Bind groups: Groups 0, 1, 2.

### Skinned Mesh (Stride 64 Bytes)
- Attribute 0: `position` (`Float32x3`, offset 0)
- Attribute 1: `normal` (`Float32x3`, offset 12)
- Attribute 2: `uv` (`Float32x2`, offset 24)
- Attribute 3: `joints` (`Uint32x4`, offset 32)
- Attribute 4: `weights` (`Float32x4`, offset 48)
- Bind groups: Groups 0, 1, 2, 3 (`uBones` storage buffer).

---

## Hardware Alignment Guarantees

WebGPU hardware constraints enforced across the backend:
- Buffer allocations and `writeBuffer` calls are rounded up to 4-byte boundaries.
- Material uniform structs in Group 2 are padded to 16-byte boundaries.
- Float parameters align to 4 bytes; vector4 parameters align to 16 bytes.
