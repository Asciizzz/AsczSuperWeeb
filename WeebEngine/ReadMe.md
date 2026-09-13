# WeebEngine

High-performance 3D engine architecture built on Atoolkit:
- `aecs`: Standalone component sets and entity pools for state storage.
- `alm`: Native Float32Array linear algebra with zero-allocation out parameters.
- `acircuit`: Typed socket computation graph driving shader graph topology.
- `awgpu`: Domain-agnostic WebGPU execution engine with 4-tier frequency bind slots.

---

## Architectural Principles

### 1. Three-Tier Separation of Concerns

Pipeline data flow across three tiers:
- **Tier 1 (Static CPU Assets)**: `Mesh`, `Skeleton`, `Texture`, `ShaderCircuit`.
- **Tier 2 (GPU Hardware Resources)**: `GpuMesh`, `GpuSkin`, `GpuTransform`, `GpuMaterial`, `GpuShader` (`AwgpuBuffer`, `AwgpuTexture`, `AwgpuBindGroup`, `AwgpuRenderPipeline`).
- **Tier 3 (Runtime ECS Components)**: `TransformCmp`, `MeshCmp`, `ShaderCmp`, `SkinCmp`.
- **Execution**: Systems (`TransformSystem`, `SkinSystem`, `HierarchySystem`) update dirty state -> `WeebRenderer` records into `AwgpuPass` and `AwgpuFrame`.

1. **Tier 1 (CPU Assets)**: Pure data containers (`Mesh`, `Skeleton`, `Texture`, `ShaderCircuit`). Independent of GPU devices and execution contexts. Operates in headless environments.
2. **Tier 2 (GPU Resources)**: Hardware memory allocations (`AwgpuBuffer`, `AwgpuTexture`, `AwgpuBindGroup`, `AwgpuRenderPipeline`).
3. **Tier 3 (ECS Components)**: Lightweight descriptors attached to entities. Components reference GPU resources directly (`rMesh`, `rTransform`, `rShader`, `rSkin`).

### 2. Single-Entity Render Contract

Renderable entities provide all required render state through co-located components. Renderer queries matching entities in O(1) without hierarchy tree crawling during render loops:

- `TransformCmp`: Holds local TRS vectors, world matrix, dirty flag, and references `rTransform: GpuTransform`.
- `MeshCmp`: Holds direct reference to `rMesh: GpuMesh` and visibility flag.
- `ShaderCmp`: Holds direct references to `rShader: GpuShader` and `rMaterial: GpuMaterial` per slot.
- `SkinCmp`: Holds CPU skeleton asset, per-entity local poses, dirty flag, and references `rSkin: GpuSkin`.

### 3. 4-Tier Bind Frequency Alignment

Hardware bind slots follow standardized update frequencies defined in `AwgpuBindSlot`:

| Slot | Frequency Tier | Contents | Bound By |
| :--- | :--- | :--- | :--- |
| **0** | `Pass` | Camera view-projection matrix, eye position | `Camera` |
| **1** | `Phase` | Directional lights, shadow maps, environment maps | Phase passes (reserved) |
| **2** | `Material` | Material parameters uniform buffer, textures, samplers | `GpuMaterial` via `ShaderCmp` |
| **3** | `Instance` | Model matrix, skinning bone matrix storage buffer | `GpuTransform` via `TransformCmp` / `SkinCmp` |

When drawing multiple objects sharing material, slots 0, 1, and 2 remain bound; only slot 3 updates per instance.

---

## Core Components

### TransformCmp

```ts
export class TransformCmp {
    position: V3;
    rotation: Q4;
    scale: V3;
    worldMatrix: M16;
    isDirty: boolean;
    readonly rTransform: GpuTransform;
}
```

- When dirty, `TransformSystem` computes `worldMatrix` via `Mat4.fromTRS` and uploads 64-byte matrix directly to `rTransform.buffer`.
- Inactive / static transforms incur zero CPU math and zero GPU upload overhead.

### MeshCmp

```ts
export class MeshCmp {
    readonly rMesh: GpuMesh;
    visible: boolean;
    submeshMask?: number;
}
```

- References GPU geometry container holding vertex `AwgpuBuffer`, index `AwgpuBuffer`, index format, index count, and `vertexLayout`.

### ShaderCmp

```ts
export class ShaderCmp {
    readonly rShader: GpuShader;
    readonly materials: (GpuMaterial | null)[];
}
```

- References compiled static and skinned WebGPU pipelines (`AwgpuRenderPipeline`).
- References `GpuMaterial` managing material constants and textures for Slot 2 bind group.

### SkinCmp

```ts
export class SkinCmp {
    readonly rSkeleton: Skeleton;
    readonly rSkin: GpuSkin;
    readonly localPoses: JointPose[];
    isDirty: boolean;
}
```

- References GPU storage buffer holding flattened `jointPalette` matrix array (`jointCount * 16` floats).
- `SkinSystem` computes concatenated joint matrices in topological order and uploads directly to GPU buffer.

---

## Systems

- **`TransformSystem`**: Evaluates dirty transforms and uploads world matrices to GPU buffers.
- **`SkinSystem`**: Evaluates skeletal joint poses and uploads bone matrix palettes to GPU storage buffers.
- **`HierarchySystem`**: Propagates spatial transforms down parent-child node trees, marking children dirty for GPU synchronization.

---

## Quickstart

```typescript
import {
    WeebWorld,
    WeebRenderer,
    Camera,
    TransformCmp,
    MeshCmp,
    ShaderCmp,
    Mesh,
    ShaderCircuit,
    ColorNode,
    AwgpuDevice,
} from "./index.js";

// 1. Initialize GPU Device and Renderer
const device = await AwgpuDevice.create({ canvas: "#canvas" });
const renderer = new WeebRenderer(device);

// 2. Author Shader Circuit
const circuit = new ShaderCircuit("ToonShader");
const tintNode = new ColorNode("tint", [1.0, 0.4, 0.2, 1.0], true, "tintColor");
circuit.addNode(tintNode);
circuit.connect(tintNode, "color", circuit.outputNode, "baseColor");

// 3. Compile GPU Shader and Create Material
const gShader = renderer.createShader(circuit);
const gMaterial = gShader.createMaterial(device.device);

// 4. Define CPU Geometry and Upload to GPU
const cpuMesh = new Mesh(
    "Triangle",
    new Float32Array([
        // Position(3), Normal(3), UV(2)
        -1, -1, 0,   0, 0, 1,   0, 1,
         1, -1, 0,   0, 0, 1,   1, 1,
         0,  1, 0,   0, 0, 1,   0.5, 0,
    ]),
    new Uint16Array([0, 1, 2])
);
const gMesh = renderer.createMesh(cpuMesh);

// 5. Initialize Camera
const camera = new Camera(device.device, 60, canvas.width / canvas.height);
camera.lookAt([0, 2, 5], [0, 0, 0]);

// 6. Spawn Entity in ECS World
const world = new WeebWorld();
const gTransform = renderer.createTransform();

world.spawn(
    new TransformCmp(gTransform, [0, 0, 0]),
    new MeshCmp(gMesh),
    new ShaderCmp(gShader, gMaterial)
);

// 7. Render Loop
function frame() {
    renderer.render(world, camera);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```
