# WeebGfx

Hardware graphics execution, procedural shading, and rendering technique library built on Atoolkit:
- `aecs`: Standalone component sets and entity pools for state storage.
- `alm`: Native Float32Array linear algebra with zero-allocation out parameters.
- `acircuit`: Typed socket computation graph driving procedural shader topology.
- `awgpu`: Domain-agnostic WebGPU hardware execution engine with 4-tier frequency bind slots.

---

## Architecture

### 1. Data-Oriented Design (DOD) Separation

Pipeline data flow separates into four distinct layers:

1. **CPU Assets**: Pure data containers (`Mesh`, `Texture`, `Skeleton`, `ShaderCircuit`). Independent of GPU devices and execution contexts. Operates in worker threads or headless environments.
2. **Runtime ECS Components**: Lightweight plain old data (`TransformCmp`, `MeshCmp`, `MaterialCmp`, `SkinCmp`). Zero GPU handles.
3. **Decoupled Buffer Streaming**: Specialized synchronizers (`TransformSync`, `SkinSync`) that stream CPU component sets into GPU uniform and storage buffers in bulk.
4. **Independent Techniques**: Composable execution strategies (`RasterTechnique`, `RayTraceTechnique`, `MotionGfxTechnique`) that consume loose component sets and record draws into `AwgpuPass`.

### 2. 4-Tier Hardware Frequency Alignment

Hardware bind slots follow standardized update frequencies defined in `AwgpuBindSlot`:

| Slot | Frequency Tier | Raster Meaning | Ray Tracing Meaning | Motion Graphics Meaning | Bound By |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `Pass` | Camera view-projection matrix | Ray camera origin and inverse matrix | Viewport resolution, time, beat pulse | `GfxCamera` |
| **1** | `Phase` | Directional lights, shadow maps | Environment lighting, sun disc | Background gradient and ripple params | Phase passes |
| **2** | `Material` | Material constants, textures | Surface optical properties | Procedural noise and SDF shape params | `MaterialCmp` |
| **3** | `Instance` | Model matrix, skinned bone palette | Scene primitive storage buffer | Instanced 2D glyph streams | `TransformSync` / Instance VBO |

---

## Core Assets

### Mesh

```ts
export class Mesh {
    readonly name: string;
    readonly vertexData: Float32Array;
    readonly indexData: Uint16Array | Uint32Array;
    readonly attributes: MeshAttributeDesc[];
    readonly submeshes: SubmeshDesc[];
}
```

- Flexible attribute descriptor array defining arbitrary vertex layouts (e.g. 2D positions, vertex colors, 3D normals).
- Multiple submeshes with independent index ranges and material slot indices.

### ShaderCircuit

```ts
export class ShaderCircuit extends Acircuit {
    readonly name: string;
    renderState: PipelineRenderState;
    readonly outputNode: OutputNode;
}
```

- Directed micro-node graph compiled into WGSL vertex and fragment stages.
- Configurable `PipelineRenderState` controlling `blendMode` (`opaque`, `alpha-blend`, `additive`), `cullMode`, and `depthMode`.

---

## Rendering Techniques

### RasterTechnique

```ts
export class RasterTechnique implements GfxTechnique {
    record(pass: AwgpuPass, params: RasterRecordParams): void;
}
```

- Queries matching entities across loose component sets: `transforms`, `meshes`, `materials`, and optional `skins`.
- Automatically caches hardware `GpuMesh` and `GpuShader` instances.
- Evaluates dirty transforms and bone palettes via `TransformSync` and `SkinSync`.

### RayTraceTechnique

```ts
export class RayTraceTechnique implements GfxTechnique {
    record(pass: AwgpuPass, params: RayTraceRecordParams): void;
}
```

- Executes multi-bounce analytical ray tracing or screen-space compute passes using single fullscreen triangle.
- Reads packed scene primitives from storage buffer at Slot 3.

### MotionGfxTechnique

```ts
export class MotionGfxTechnique implements GfxTechnique {
    record(pass: AwgpuPass, params: MotionGfxRecordParams): void;
}
```

- Renders 2D and pseudo-2D mixed motion graphics (fullscreen kinetic backgrounds and instanced billboard glyphs).
- Operates with alpha blending and depth-test read-only configuration.

---

## Declarative Composition

```typescript
import {
    GfxComposer,
    GfxCamera,
    RasterTechnique,
    TransformCmp,
    MeshCmp,
    MaterialCmp,
    Mesh,
    ShaderCircuit,
    ColorNode,
} from "ascz-super-weeb/WeebGfx";
import { ComponentSet } from "ascz-super-weeb/Atoolkit/aecs";
import { AwgpuDevice } from "ascz-super-weeb/Atoolkit/awgpu";

// 1. Initialize Device and Declarative Composer
const device = await AwgpuDevice.create({ canvas: "#canvas" });
const composer = new GfxComposer(device);
const camera = new GfxCamera(device.device, "perspective");
const rasterTech = new RasterTechnique(device.device);

// 2. Define Standalone Component Sets
const transforms = new ComponentSet<TransformCmp>();
const meshes = new ComponentSet<MeshCmp>();
const materials = new ComponentSet<MaterialCmp>();

// 3. Populate Data
const circuit = new ShaderCircuit("PopShader");
circuit.addNode(new ColorNode("color", [1.0, 0.4, 0.2, 1.0], true, "tint"));

const mesh = new Mesh("Triangle", new Float32Array([
    -1, -1, 0,  0, 0, 1,  0, 1,
     1, -1, 0,  0, 0, 1,  1, 1,
     0,  1, 0,  0, 0, 1,  0.5, 0,
]), new Uint16Array([0, 1, 2]));

transforms.set(1, new TransformCmp([0, 0, 0]));
meshes.set(1, new MeshCmp(mesh));
materials.set(1, new MaterialCmp(circuit));

// 4. Render Loop
function frame(time: number) {
    camera.update(device.device, canvas.width / canvas.height, time);

    const mainPass = composer.createPass("MainPass");
    rasterTech.record(mainPass, {
        passBindGroup: camera.bindGroup,
        transforms,
        meshes,
        materials,
    });

    composer.execute(mainPass);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```
