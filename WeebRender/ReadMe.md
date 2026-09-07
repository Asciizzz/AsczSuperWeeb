# WeebRender

3D rendering engine built on the `Atoolkit` library suite:
- `Aecs`: Sparse-set Entity Component System for state queries.
- `Acmp`: Composable execution step payloads.
- `Aflow`: Directed execution graph for pass scheduling.
- `Alm`: Linear algebra matrices and quaternions.
- `Adataflow`: Typed socket computation graph driving shader graph topology.

---

## Architecture

### Decoupled CPU Assets

Pure CPU memory representations with zero hardware allocations:

- `Mesh`: Interleaved vertex buffers (`Float32Array`), index buffers (`Uint16Array` or `Uint32Array`), vertex attributes, and submesh partitions. Operates in headless environments and across multiple GPU backends.
- `Texture`: CPU image buffer holding pixel dimensions (`width`, `height`) and byte buffers (`Uint8Array`).
- `Skeleton`: Joint definitions, hierarchy parent indices, bind pose transforms, and inverse bind matrices.
- `ShaderGraph`: Node graph describing math, uniforms, texture sampling, and lighting logic. Compiles to a backend-agnostic `CompiledShaderBlueprint`.

### Universal GPU Handles (`gpu.ts`)

Universal handles store common metadata and expose uniform parameter helpers on the CPU, holding hardware-specific state in `backend`:

- `GpuMesh<TBackend = unknown>`: Vertex count, index count, vertex stride, attributes, submesh ranges, and optional CPU mesh reference.
- `GpuTexture<TBackend = unknown>`: Dimensions, label, GPU ownership flag, and optional CPU texture reference.
- `GpuShader<TBackend = unknown>`: Compiled blueprint, `ShaderParamLayout`, and parameter query methods (`getParamNames`, `hasParam`, `getDefaultParam`, `createDefaultParams`, `createParamsCmp`).

Ergonomic aliases `GMesh`, `GTexture`, `GShader`, and `Shader` map directly to these universal handles.

### Hardware Backends

#### WebGPU (`wgpu/`)

Active hardware backend:
- `WgpuMesh`: Manages `GPUBuffer` allocations, vertex and index data uploads, 4-byte padding, and dynamic buffer reallocation.
- `WgpuTexture`: Manages `GPUTexture`, `GPUTextureView`, and `GPUSampler` objects, supporting CPU texture uploads and offscreen Render-to-Texture (RTT) targets.
- `WgpuShader`: Manages `GPURenderPipeline` caching for static (stride 32) and skinned (stride 64) vertex configurations, WGSL shader modules, and bind group layouts.
- `compileWgsl`: Dedicated WebGPU shader compiler translating `ShaderGraph` AST topology into WGSL source code.
- `WgpuRenderer`: Orchestrates render passes via `Aflow`, managing camera, object, material, and skinning bind groups. Aliased as `WeebRenderer`.

See [wgpu/ReadMe.md](./wgpu/ReadMe.md) for WebGPU backend details.

#### WebGL2 (`wgl2/`)

Architectural roadmap for WebGL2:
- Translates `ShaderGraph` AST to GLSL ES 3.0.
- Specializes universal handles into `GLMesh` (`WebGLVertexArrayObject`, VBO, IBO) and `GLTexture` (`WebGLTexture`).

See [wgl2/ReadMe.md](./wgl2/ReadMe.md) for WebGL2 roadmap details.

---

## Single-Entity Render Contract

A renderable 3D entity provides all required render data through co-located components. The renderer queries matching entities in O(1) without hierarchy crawling or parent-child tree traversals during the render loop:

- `TransformCmp`: World and local position, rotation, scale, and cached `worldMatrix`.
- `MeshCmp`: GPU geometry handle (`rMesh: GpuMesh`) and visibility flag.
- `MaterialCmp`: Shader pipeline references (`shaders: GpuShader[]`) and parameter override records (`params: MaterialParamRecord[]`) per slot.
- `SkinCmp`: Flattened `jointPalette` matrix array (`Float32Array`) for linear blend skinning. Entities without `SkinCmp` render as static geometry.
- `ShaderParamsCmp`: Entity parameter values and texture overrides.

### Referenced Asset Prefix (`r`)

Static GPU handles stored within runtime ECS components use the `r` prefix:

| Component | Property | Type | Description |
| :--- | :--- | :--- | :--- |
| `MeshCmp` | `rMesh` | `GpuMesh` | Reference to the GPU mesh handle |
| `SkinCmp` | `rSkeleton` | `Skeleton` | Reference to the CPU skeleton hierarchy |

### Explicit GPU Boundary Invariant

The renderer operates on GPU handles rather than auto-converting CPU buffers on the fly:
- `MeshCmp` requires a `GpuMesh`. Use `renderer.createMesh(cpuMesh)` or `WgpuMesh.fromMesh(device, cpuMesh)`.
- Texture parameters require a `GpuTexture`. Use `renderer.createTexture(cpuTexture)` or `WgpuTexture.fromTexture(device, cpuTexture)`.
- Offscreen Render-to-Texture (RTT) targets wrap raw textures via `WgpuTexture.ref(rawTexture, options)` or `renderer.createRenderTarget(width, height)`.

---

## Quickstart

```typescript
import { Aecs } from "../Atoolkit/aecs/index.js";
import {
    WeebRenderer,
    CameraCmp,
    TransformCmp,
    MeshCmp,
    MaterialCmp,
    Mesh,
    ShaderGraph,
    ColorNode,
    WgpuShader,
} from "./index.js";

// 1. Author Shader Graph
const graph = new ShaderGraph("AlpineMaterial");
const tintNode = new ColorNode("tintColor", [0.8, 0.8, 0.9, 1.0], true, "tintColor");
graph.addNode(tintNode);
graph.connect(tintNode, "color", graph.outputNode, "baseColor");

// 2. Instantiate Shader from Graph
const rockShader = new WgpuShader(graph);

// 3. Define CPU Geometry
const cpuMesh = new Mesh(
    "MountainPeak",
    new Float32Array([
        // Position(3), Normal(3), UV(2)
        -1, -1, 0,   0, 0, 1,   0, 1,
         1, -1, 0,   0, 0, 1,   1, 1,
         0,  1, 0,   0, 0, 1,   0.5, 0,
    ]),
    new Uint16Array([0, 1, 2]),
    [{ name: "Peak", indexStart: 0, indexCount: 3 }]
);

// 4. Initialize Renderer and Camera
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const camera = new CameraCmp(60, canvas.width / canvas.height, 0.1, 1000);
camera.lookAt([0, 2, 5], [0, 0, 0]);

const renderer = new WeebRenderer(canvas);
await renderer.init();

// 5. Upload CPU Mesh to GPU Handle
const gMesh = renderer.createMesh(cpuMesh);

// 6. Spawn Renderable Entity in ECS
const ecs = new Aecs();
ecs.spawn(
    new TransformCmp([0, 0, 0]),
    new MeshCmp(gMesh),
    new MaterialCmp([rockShader], [{ tintColor: [1.0, 0.2, 0.2, 1.0] }])
);

// 7. Render Frame
renderer.render(ecs, camera);
```
