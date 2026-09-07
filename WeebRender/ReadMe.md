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

### Static Assets

Static assets define GPU or CPU data buffers:

- `Mesh`: Interleaved vertex buffers (`Float32Array`), index buffers (`Uint16Array` or `Uint32Array`), vertex attributes, and index partitions (`Submesh`). Supports direct GPU allocation (`gpuCreate`), external GPU buffer attachment (`ref`), dynamic GPU updating (`updateGpu`), and explicit ownership management (`gpuOwned`).
- `Texture`: Image container holding pixel dimensions and raw byte buffers (`Uint8Array`). Supports self-allocated WebGPU textures (`gpuCreate`) or externally referenced textures (`ref`), enabling seamless Render-to-Texture (RTT), offscreen passes, and canvas blitting without side-table caches.
- `Skeleton`: Joint definitions, hierarchy parent indices, bind pose transforms, and inverse bind matrices.
- `Shader`: Compiled WGSL pipelines, uniform buffer blueprints, and bind group layouts.

### Runtime Components

Attached to ECS entities to drive positioning, rendering, and animation:

- `TransformCmp`: Holds TRS vectors (`position`, `rotation`, `scale`), dirty flag, and precomputed `worldMatrix`.
- `MeshCmp`: Holds `rMesh` reference and a `visible` toggle.
- `MaterialCmp`: Holds shader pipeline references (`shaders`) and runtime uniform overrides (`params`) per slot.
- `SkinCmp`: Holds `rSkeleton` reference, dynamic `jointPalette` GPU buffer, and per-entity joint poses.
- `CameraCmp`: Holds FOV, aspect ratio, clipping planes, eye position vector, view matrix, and projection matrix.
- `ShaderParamsCmp`: Holds legacy uniform overrides.

### Referenced Asset Prefix (`r`)

Every referenced static asset held within a runtime ECS component uses the `r` prefix:

| Container | Property | Description |
| :--- | :--- | :--- |
| `MeshCmp` | `rMesh` | Direct reference to the static `Mesh` asset |
| `SkinCmp` | `rSkeleton` | Direct reference to the static `Skeleton` asset |

### Shader Graph Architecture

Micro-node graphs built on `Adataflow` that compile directly to WGSL pipelines:

- **Micro-Nodes (1-3 Sockets)**:
  - `ColorNode`: Outputs `color` (vec4), `rgb` (vec3), `alpha` (float).
  - `FloatNode`: Outputs scalar `value` (float).
  - `TextureSampleNode`: Inputs `uv` (vec2), outputs `color` (vec4), `rgb` (vec3), `alpha` (float).
  - `MathNode`: Inputs `a`, `b`, outputs `out` (`add`, `multiply`, `subtract`, `divide`).
  - `MixNode`: Inputs `a`, `b`, `factor`, outputs `out`.
  - `OutputNode`: Surface sink accepting `baseColor` (vec4), `alpha` (float), `emissive` (vec3).

- **Parameter Mode**:
  Nodes toggle parameter mode (`isParam: true`, `paramName: "tintColor"`), allocating aligned uniform buffer offsets exposed to `MaterialCmp` and `ShaderParamsCmp`.

- **Built-in Defaults**:
  Graphs define default parameter values. Call `shader.createDefaultParams()` to instantiate parameter records pre-filled with defaults.

For exhaustive documentation on every node, socket, layout calculation, and compile step, see [`WeebRender/shader/ReadMe.md`](file:///C:/Users/Admin/Downloads/AsczSuperWeeb/WeebRender/shader/ReadMe.md).

### Flat ECS Architecture

Flat entity layout without scene graph trees or relational parenting:

- Render passes query the ECS directly for entities possessing `MeshCmp`.
- **Identity Fallback**: Entities lacking `TransformCmp` draw at origin `(0, 0, 0)` via identity matrices.
- Decoupled entities evaluate matrices in flat loops without recursive hierarchy walks.

### Render Graph Boundaries

Frame execution orchestrated via `Aflow`:

```
FrameStart -> RenderPass -> SceneDrawStep -> EndPass -> FrameEnd
```

- `FrameStart` (`BeginFrame`): Allocates command encoder for active frame.
- `RenderPass`: Configures color attachments and depth stencil views.
- `SceneDrawStep`: Iterates flat ECS queries, sets pipelines, binds uniform/vertex/index buffers, and issues draw calls.
- `EndPass`: Closes active render pass encoder.
- `FrameEnd` (`EndFrame`): Submits command buffers to GPU queue.

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
const texNode = new TextureSampleNode("rockTex", new Texture("Rock", 64, 64), true, "mainTexture");
const tintNode = new ColorNode("tintColor", [0.8, 0.8, 0.9, 1.0], true, "tintColor");
const mulNode = new MathNode("blend", "multiply");

graph.addNode(texNode);
graph.addNode(tintNode);
graph.addNode(mulNode);

graph.connect(texNode, "color", mulNode, "a");
graph.connect(tintNode, "color", mulNode, "b");
graph.connect(mulNode, "out", graph.outputNode, "baseColor");

const bp = graph.compile();
const rockShader = new Shader(bp!);

// 2. Create Geometry Mesh
const mesh = new Mesh(
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

// 3. Setup ECS World and Entities
const ecs = new Aecs();

// Entity with custom parameter override via MaterialCmp
const entity1 = ecs.spawn(
    new TransformCmp([0, 1, 0]),
    new MeshCmp(mesh),
    new MaterialCmp([rockShader], [{ tintColor: [1.0, 0.2, 0.2, 1.0] }])
);

// Entity using shader blueprint defaults
const entity2 = ecs.spawn(
    new TransformCmp([3, 0, 0]),
    new MeshCmp(mesh),
    new MaterialCmp(rockShader, rockShader.createDefaultParams())
);

// 4. Initialize Camera and Renderer
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const camera = new CameraCmp(60, canvas.width / canvas.height, 0.1, 1000);
camera.lookAt([0, 2, 5], [0, 0, 0]);

const renderer = new WeebRenderer(canvas);
await renderer.init();

// 5. Render Frame
renderer.render(ecs, camera);
```
