# WeebRender Engine

Pure 3D rendering engine built on the Atoolkit suite:
- **Aecs**: Sparse-set Entity Component System for runtime entity queries.
- **Acmp**: Composable component and step payloads.
- **Aflow**: Directed execution graph for pipeline and pass recording.
- **Awgpu**: Low-level WebGPU abstraction and buffer utilities.
- **Alm**: Zero-allocation linear algebra matrices and quaternions.
- **Adataflow**: Typed socket computation graph driving shader graph evaluation and code emission.

---

## Core Architecture

### Decoupled CPU Primitives

Primitives represent pure, backend-agnostic CPU memory buffers with zero hardware dependencies:

- [`Mesh`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/mesh.ts): Interleaved vertex buffers (`Float32Array`), index buffers (`Uint16Array` or `Uint32Array`), vertex attributes, and index partitions (`Submesh`). Completely free of GPU handles, enabling execution in headless environments or multiple backends.
- [`Texture`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/texture.ts): CPU image container holding pixel dimensions (`width`, `height`) and raw byte buffers (`Uint8Array`). Holds no GPU textures or device references.
- [`Skeleton`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/skin.ts): Joint definitions, hierarchy parent indices, bind pose transforms, and inverse bind matrices.
- [`ShaderGraph`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/shader/graph.ts): Node graph describing math, uniforms, texture sampling, and lighting logic. Compiles to an intermediate blueprint (`ShaderBlueprint`).

### Hardware GPU Representations (`WeebRender/wgpu/`)

Backend-specific GPU resource wrappers allocate, update, and manage hardware state:

- [`GMesh`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/wgpu/gmesh.ts): Hardware vertex and index buffers (`GPUBuffer`), index format (`GPUIndexFormat`), index count, vertex stride, attributes, and submeshes. Can be created via `GMesh.fromMesh(device, mesh)` or referenced directly via `GMesh.ref(...)`.
- [`GTexture`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/wgpu/gtexture.ts): Hardware texture resource wrapping `GPUTexture`, `GPUTextureView`, and `GPUSampler`. Supports CPU upload via `GTexture.fromTexture(device, texture)` or offscreen pass binding via `GTexture.ref(...)` for Render-to-Texture (RTT).
- [`GShader`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/wgpu/gshader.ts): WebGPU pipeline and bind group layout manager. Manages WGSL shader modules, uniform memory offsets, and cached render pipelines per vertex stride and skinning mode. Re-exported as `Shader`.
- [`WgpuRenderer`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/wgpu/renderer.ts): WebGPU rendering engine orchestrating passes through `Aflow`. Dispatches `GMesh` vertex/index buffers directly and binds `GTexture` resources without side-table caches or hidden promotion logic. Re-exported as `WeebRenderer`.

### WebGL2 Backend Roadmap (`WeebRender/wgl2/`)

- [`WeebRender/wgl2`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/wgl2/index.ts): Architectural stub for the future WebGL2 backend. CPU primitives (`Mesh`, `Texture`) will be uploaded to corresponding `GLMesh` and `GLTexture` objects, targeting a unified interface across web graphics APIs.

### Runtime Components

Attached to ECS entities to drive positioning, rendering, and animation:

- `TransformCmp`: Holds TRS vectors (`position`, `rotation`, `scale`), dirty flag, and precomputed `worldMatrix`.
- `MeshCmp`: Holds `rMesh` reference (strictly typed to `GMesh`) and a `visible` toggle.
- `MaterialCmp`: Holds shader references (`GShader`) and runtime uniform/texture overrides (`MaterialParamRecord`) per material slot. Texture parameters must be provided as `GTexture`.
- `SkinCmp`: Holds `rSkeleton` reference, dynamic `jointPalette` GPU buffer, and per-entity joint poses.
- `CameraCmp`: Holds FOV, aspect ratio, clipping planes, eye position vector, view matrix, and projection matrix.
- `ShaderParamsCmp`: Holds runtime uniform and texture overrides.

### Referenced Asset Prefix (`r`)

Every referenced static GPU asset held within a runtime ECS component uses the `r` prefix:

| Container | Property | Description |
| :--- | :--- | :--- |
| `MeshCmp` | `rMesh` | Direct reference to the GPU hardware `GMesh` asset |
| `SkinCmp` | `rSkeleton` | Direct reference to the static `Skeleton` asset |

### Explicit GPU Boundary Invariant

The renderer intentionally avoids auto-converting or caching raw CPU objects internally:
- `MeshCmp` accepts `GMesh`. Call `renderer.createMesh(cpuMesh)` or `GMesh.fromMesh(device, cpuMesh)`.
- Texture uniform parameters accept `GTexture`. Call `renderer.createTexture(cpuTexture)` or `GTexture.fromTexture(device, cpuTexture)`.
- Offscreen Render-to-Texture (RTT) targets wrap raw `GPUTexture` handles via `GTexture.ref(rawTexture, view, sampler)` without requiring dummy CPU textures.

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
    Texture,
    ShaderGraph,
    ColorNode,
    TextureSampleNode,
    MathNode,
    Shader,
} from "./index.js";

// 1. Build a Shader Graph
const graph = new ShaderGraph("CustomAlpine");
const tintNode = new ColorNode("tintColor", [0.8, 0.8, 0.9, 1.0], true, "tintColor");
graph.addNode(tintNode);
graph.connect(tintNode, "color", graph.outputNode, "baseColor");

const bp = graph.compile();
const rockShader = new Shader(bp!);

// 2. Create CPU Geometry Mesh
const cpuMesh = new Mesh(
    "MountainPeak",
    new Float32Array([
        // Pos(3), Normal(3), UV(2)
        -1, -1, 0,   0, 0, 1,   0, 1,
         1, -1, 0,   0, 0, 1,   1, 1,
         0,  1, 0,   0, 0, 1,   0.5, 0,
    ]),
    new Uint16Array([0, 1, 2]),
    [{ name: "Peak", indexStart: 0, indexCount: 3 }]
);

// 3. Initialize Camera and Renderer
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const camera = new CameraCmp(60, canvas.width / canvas.height, 0.1, 1000);
camera.lookAt([0, 2, 5], [0, 0, 0]);

const renderer = new WeebRenderer(canvas);
await renderer.init();

// 4. Upload CPU Primitives to GPU Representations
const gMesh = renderer.createMesh(cpuMesh);

// 5. Setup ECS World and Entities
const ecs = new Aecs();

const entity = ecs.spawn(
    new TransformCmp([0, 0, 0]),
    new MeshCmp(gMesh),
    new MaterialCmp([rockShader], [{ tintColor: [1.0, 0.2, 0.2, 1.0] }])
);

// 6. Render Frame
renderer.render(ecs, camera);
```
