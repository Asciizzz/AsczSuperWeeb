# WebGL2 Backend (WeebRender/wgl2)

Architectural specification and roadmap for the WebGL2 hardware backend in `WeebRender`.

---

## Overview

The WebGL2 backend targets WebGL 2.0 (OpenGL ES 3.0) contexts, specializing the universal GPU handles defined in `gpu.ts`. High-level scene code, ECS entities, components, and `ShaderCircuit` definitions remain unchanged between backends.

---

## Modules

### `glmesh.ts`

`GLMesh` specializes `GpuMesh<GLMeshPayload>`:

```ts
export class GLMesh extends GpuMesh<GLMeshPayload> {
    static fromMesh(gl: WebGL2RenderingContext, mesh: Mesh): GLMesh;
    static ref(vao: WebGLVertexArrayObject, vbo: WebGLBuffer, ibo?: WebGLBuffer): GLMesh;
}
```

* **`fromMesh(...)`**: Configures vertex attribute pointers from `VertexAttribute` metadata and uploads buffer data.
* **`ref(...)`**: Wraps external VAO and buffer handles without taking ownership of underlying allocations.

### `gltexture.ts`

`GLTexture` specializes `GpuTexture<GLTexturePayload>`:

```ts
export class GLTexture extends GpuTexture<GLTexturePayload> {
    static fromTexture(gl: WebGL2RenderingContext, texture: Texture): GLTexture;
    static ref(texture: WebGLTexture): GLTexture;
}
```

* **`fromTexture(...)`**: Allocates a 2D texture, sets minification, magnification, and wrap parameters, and uploads pixel buffers.
* **`ref(...)`**: Wraps external WebGL textures such as framebuffer attachment targets.

### `glshader.ts`

`GLShader` specializes `GpuShader<GLShaderPayload>`:

```ts
export class GLShader extends GpuShader<GLShaderPayload> {
    constructor(circuit: ShaderCircuit);
    invalidateGpu(): void;
}
```

* **`constructor(circuit)`**: Compiles the `ShaderCircuit` into GLSL ES 3.0 programs and sets up uniform block layouts.
* **`invalidateGpu()`**: Discards compiled program caches to force recreation upon parameter or circuit modification.

### `glsl.ts`

Dedicated WebGL2 shader code compiler:
- `compileGlsl(circuit, options)`: Translates `ShaderCircuit` nodes into GLSL ES 3.0 vertex and fragment shaders.
- Emits `#version 300 es`, standard attribute locations, and uniform blocks.

### `renderer.ts`

`Wgl2Renderer`:
- Initializes `WebGL2RenderingContext`, canvas viewport, depth test, and blending state.
- Executes scene draw calls by iterating entities with `MeshCmp` and `TransformCmp`.
- Binds `GLMesh` VAO, activates texture units, uploads uniform blocks, and dispatches `gl.drawElements`.

---

## State Mapping

| Engine Construct | WebGPU Backend | WebGL2 Backend |
| :--- | :--- | :--- |
| **Mesh Handle** | `WgpuMesh` (`GPUBuffer`) | `GLMesh` (`WebGLVertexArrayObject`, `WebGLBuffer`) |
| **Texture Handle** | `WgpuTexture` (`GPUTextureView`, `GPUSampler`) | `GLTexture` (`WebGLTexture`, texture unit) |
| **Shader Handle** | `WgpuShader` (`GPURenderPipeline`) | `GLShader` (`WebGLProgram`) |
| **Shading Language** | WGSL | GLSL ES 3.0 (`#version 300 es`) |
| **Camera State** | `@group(0) @binding(0) var<uniform> uCamera` | `layout(std140) uniform CameraUniforms` |
| **Object State** | `@group(1) @binding(0) var<uniform> uObject` | `layout(std140) uniform ObjectUniforms` |
| **Material Parameters**| `@group(2) @binding(0) var<uniform> uMaterial` | `layout(std140) uniform MaterialUniforms` |
| **Skeletal Bones** | `@group(3) @binding(0) var<storage, read> uBones` | Texture buffer or matrix uniform array |
