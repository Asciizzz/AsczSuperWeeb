# WebGL2 Backend (WeebRender/wgl2)

Architectural specification and roadmap for the WebGL2 hardware backend in `WeebRender`.

I feel like I kinda neglect webgl2 a bit too much

---

## Overview

The WebGL2 backend targets WebGL 2.0 (OpenGL ES 3.0) contexts, specializing the universal GPU handles defined in `gpu.ts`. High-level scene code, ECS entities, components, and `ShaderGraph` definitions remain unchanged between backends.

---

## Planned Components

### `glmesh.ts`

`GLMesh` specializes `GpuMesh<GLMeshPayload>`:
- Manages `WebGLVertexArrayObject` (VAO), vertex buffer (`WebGLBuffer`), and element array buffer (`WebGLBuffer`).
- Configures vertex attribute pointers from `VertexAttribute` metadata on allocation.
- Binds VAO in a single call during draw pass execution.

### `gltexture.ts`

`GLTexture` specializes `GpuTexture<GLTexturePayload>`:
- Manages `WebGLTexture` with 2D texture targets.
- Sets minification, magnification, and wrap parameters (`gl.texParameteri`).
- Uploads pixel buffers via `gl.texImage2D` or `gl.texSubImage2D`.
- Supports framebuffer attachment binding for offscreen render targets.

### `glshader.ts`

`GLShader` specializes `GpuShader<GLShaderPayload>`:
- Manages compiled `WebGLProgram` linking vertex and fragment shaders.
- Maintains cached `WebGLUniformLocation` lookups for camera, object, and material parameters.
- Supports Uniform Buffer Objects (`UBO`) via `gl.bindBufferBase(gl.UNIFORM_BUFFER, ...)` or direct uniform updates.

### `glsl.ts`

Dedicated WebGL2 shader code compiler:
- Translates `ShaderCircuit` nodes into GLSL ES 3.0 vertex and fragment shaders.
- Emits `#version 300 es`, standard attribute locations (`layout(location = 0) in vec3 position;`), and uniform blocks.
- Invoked by `GLShader` via `compileGlsl(circuit, options)`.

### `renderer.ts`

`Wgl2Renderer`:
- Initializes `WebGL2RenderingContext`, canvas viewport, depth test, and blending state.
- Executes scene draw calls by iterating entities with `MeshCmp` and `TransformCmp`.
- Binds `GLMesh` VAO, activates texture units, uploads uniform blocks, and calls `gl.drawElements`.

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
