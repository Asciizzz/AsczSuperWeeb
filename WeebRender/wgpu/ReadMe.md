# WebGPU Backend (WeebRender/wgpu)

WebGPU hardware implementation for `WeebRender`, managing GPU buffers, pipelines, textures, and Aflow pass recording.

---

## Modules

### `wmesh.ts`

`WgpuMesh` specializes `GpuMesh<WgpuMeshPayload>`:

```ts
export class WgpuMesh extends GpuMesh<WgpuMeshPayload> {
    static fromMesh(device: GPUDevice, mesh: Mesh, label?: string): WgpuMesh;
    static ref(vertexBuffer: GPUBuffer, indexBuffer?: GPUBuffer, options?: WgpuMeshRefOptions): WgpuMesh;
    updateFromMesh(device: GPUDevice, mesh: Mesh): void;
}
```

* **`fromMesh(...)`**: Allocates GPU buffers with 4-byte padding guarantees and uploads vertex and index data.
* **`ref(...)`**: Wraps existing GPU buffers without taking ownership of underlying allocations.
* **`updateFromMesh(...)`**: Dynamically reallocates GPU buffers if incoming mesh data exceeds current buffer capacity.

### `wtexture.ts`

`WgpuTexture` specializes `GpuTexture<WgpuTexturePayload>`:

```ts
export class WgpuTexture extends GpuTexture<WgpuTexturePayload> {
    static fromTexture(device: GPUDevice, texture: Texture, options?: WgpuTextureOptions): WgpuTexture;
    static ref(texture: GPUTexture, options?: WgpuTextureRefOptions): WgpuTexture;
    destroy(): void;
}
```

* **`fromTexture(...)`**: Allocates a 2D `GPUTexture`, derives format parameters, and writes pixel byte buffers.
* **`ref(...)`**: Wraps external textures (e.g. render targets) with custom view and sampler configurations.

### `wshader.ts`

`WgpuShader` specializes `GpuShader<WgpuShaderPayload>`:

```ts
export class WgpuShader extends GpuShader<WgpuShaderPayload> {
    constructor(circuit: ShaderCircuit);
    invalidateGpu(): void;
}
```

* **`constructor(circuit)`**: Compiles the `ShaderCircuit` directly to WGSL and sets up pipeline layouts on initialization.
* **`invalidateGpu()`**: Discards cached pipelines to force hardware pipeline recreation upon parameter or circuit changes.

### `wgsl.ts`

Dedicated WebGPU shader code compiler:
- `compileWgsl(circuit, options)`: Traverses `ShaderCircuit` topology, validates parameter uniqueness, builds memory layouts, and generates WGSL vertex and fragment programs.
- Emits WGSL code for both static (stride 32) and skinned (stride 64) vertex paths.

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
