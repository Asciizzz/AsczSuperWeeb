# Dynamic Vertex Pipeline & Anonymous Attribute Architecture

Architectural specification for direct hardware vertex layouts, stage-unified computation circuits, single static assignment code generation, and implicit boundary interpolation in `WeebRender`.

---

## 1. Architectural Mindset & Motivation

### The Problem with Semantic Attributes
Traditional graphics engines bind vertex data through fixed semantic names (`POSITION`, `NORMAL`, `TEXCOORD_0`, `JOINTS_0`, `WEIGHTS_0`). This abstraction introduces three fundamental architectural flaws:
1. **Artificial Semantic Coupling**: Modern GPU hardware (WebGPU, Vulkan, Metal, Direct3D 12) possesses zero awareness of semantic strings. Hardware operates strictly on byte streams, sequential `shaderLocation` indices (`@location(0)`, `@location(1)`), byte offsets, and `arrayStride`.
2. **Dual-Pipeline Fragmentation**: When vertex structures are rigid, engines split into parallel implementations (e.g. `codeStatic` vs `codeSkinned`, magic stride 32 vs 64 checks). Adding custom vertex channels (multi-UVs, tangents, wind stiffness, foliage phase) requires intrusive engine refactoring.
3. **Fragment-Centric Circuit Limitation**: A shader graph that only evaluates surface color delegates vertex manipulation to static code templates, preventing procedural vertex displacement, custom rigging, and vertex animation.

### The Direct Layout Model
The direct layout model treats vertices as pure ordered sequences of typed hardware formats:
- Sockets and nodes declare physical GPU formats (`float32x3`, `float32x2`, `uint32x4`, `float32x4`).
- Attribute order in memory dictates hardware location binding directly.
- Names are purely developer-facing labels for graph clarity, exerting zero influence over hardware pipeline construction.
- A single unified circuit authors both geometry transformations (`vs_main`) and surface rasterization (`fs_main`).

---

## 2. Component Layer: Retirement of `MaterialCmp` for `ShaderCmp`

Because shaders in this architecture govern both geometry deformation and surface appearance, the "Material" concept is retired in favor of `ShaderCmp`:

```
Entity
├── TransformCmp (spatial position, rotation, scale)
├── MeshCmp      (raw GPU geometry buffer + layout signature)
├── ShaderCmp    (shader pipeline + unified vertex & fragment parameter overrides)
└── SkinCmp      (optional: joint matrix palette for rigging nodes)
```

`ShaderCmp` stores per-instance uniform overrides for the entire pipeline:
- **Vertex Modifiers**: `heightScale`, `displacementOffset`, `windStrength`, `waveFrequency`, `peakModifier`.
- **Fragment Modifiers**: `baseColor`, `roughness`, `metallic`, `mainTexture`.

---

## 3. Chained Vertex Attribute Layout

### Interleaved Memory Mirroring
Interleaved vertex buffers store attributes contiguously in memory: `[Attr0][Attr1][Attr2]...`. To define this structure without manual offset bookkeeping, input attribute nodes chain together sequentially:

```
[Attr0: float32x3] ──chain──> [Attr1: float32x2] ──chain──> [Attr2: float32x3]
  location: 0                   location: 1                   location: 2
  offset: 0                     offset: 12                    offset: 20
  size: 12 bytes                size: 8 bytes                 size: 12 bytes
  (out) value: vec3             (out) value: vec2             (out) value: vec3
```

### Automatic Offset & Stride Derivation
Every node in the chain computes its hardware layout properties algebraically:
- `shaderLocation = previous.shaderLocation + 1` (starting at 0).
- `offset = previous.offset + sizeof(previous.format)` (starting at 0).
- `arrayStride = sum(sizeof(format))` across the complete chain.

### Format Sizing & Typed Vector Sockets

| Hardware Format | Byte Size | Shader Location Type | WGSL Data Type | Output Socket |
| :--- | :--- | :--- | :--- | :--- |
| `float32` | 4 | `f32` | `f32` | `float` |
| `float32x2` | 8 | `vec2<f32>` | `vec2<f32>` | `vec2` |
| `float32x3` | 12 | `vec3<f32>` | `vec3<f32>` | `vec3` |
| `float32x4` | 16 | `vec4<f32>` | `vec4<f32>` | `vec4` |
| `uint16x2` | 4 | `vec2<u32>` | `vec2<u32>` | `vec2` |
| `uint16x4` | 8 | `vec4<u32>` | `vec4<u32>` | `vec4` |
| `uint32` | 4 | `u32` | `u32` | `float` |
| `uint32x4` | 16 | `vec4<u32>` | `vec4<u32>` | `vec4` |

Each `InputVertexAttributeNode` acts as a typed vector provider in the graph, outputting standard `vec2`, `vec3`, or `vec4` signals identical to mathematical vector nodes.

---

## 4. Single Static Assignment (SSA) Code Generation

### Immutable Value Bindings
In-place variable mutation (`a = a + b; a = a + c;`) causes data corruption when branches fan out to multiple consumers. The code generator enforces Single Static Assignment (SSA) by emitting unique, immutable `let` statements for every node output:

```wgsl
let node_attr0_val: vec3<f32>  = in.a0;
let node_rigged_pos: vec3<f32> = skinTransform(node_attr0_val, in.a3, in.a4);
let node_displaced: vec3<f32>  = node_rigged_pos + node_norm * node_height;
let node_clipPos: vec4<f32>    = uCamera.viewProj * uObject.modelMatrix * vec4<f32>(node_displaced, 1.0);
```

### Multi-Consumer Branch Isolation
SSA guarantees that modifying data downstream never alters upstream values:
- Node A (e.g. raw vertex position `in.a0`) can feed both a `DisplacementNode` for geometry offset and a `SlopeColorNode` in the fragment stage for snow coverage.
- The `SlopeColorNode` receives the pristine, undisplaced model coordinate without interference from the displacement calculations.

---

## 5. Implicit Boundary Interpolation (Varying Auto-Lifting)

### Stage Partitioning
Every node in `ShaderCircuit` belongs to a stage based on its terminal consumer:
- Nodes contributing to `OutputClipspaceNode` belong to the **Vertex Stage**.
- Nodes contributing to `OutputColorNode` belong to the **Fragment Stage**.

### Automatic Varying Promotion
When the compiler detects a connection originating from a vertex-stage node and terminating at a fragment-stage node, it promotes the connection to an inter-stage interpolant (varying):

```
Vertex Stage                                            Fragment Stage
[Attr1 (UV): float32x2] ──(boundary crossing wire)──> [TextureSampleNode.uv]
```

1. The compiler registers an inter-stage variable in `struct VertexOutput`:
   ```wgsl
   struct VertexOutput {
       @builtin(position) clipPosition: vec4<f32>,
       @location(0) v_interp_0: vec2<f32>,
   };
   ```
2. In `vs_main`, it automatically writes the computed vertex value:
   ```wgsl
   out.v_interp_0 = node_attr1_val;
   ```
3. In `fs_main`, the target fragment node reads from the varying:
   ```wgsl
   let node_tex_uv = in.v_interp_0;
   ```

Developers never define varying structs, allocate location slots, or write interpolant pass-through code manually.

---

## 6. Binary Layout Signatures & O(1) Validation

Without string names, mesh-to-shader compatibility is verified via **Layout Signatures**:
- A layout signature is a compact canonical representation of the sequential formats:
  ```
  "f32x3,f32x3,f32x2"
  ```
- `Mesh` derives its `layoutSignature` from its packed vertex buffer configuration.
- `Shader` derives its `layoutSignature` from its chained input attribute nodes.
- At draw time, compatibility validation executes as an `O(1)` string check:
  ```ts
  if (mesh.layoutSignature !== shader.layoutSignature) {
      throw new Error(`[WgpuRenderer] Incompatible vertex layout. Shader requires "${shader.layoutSignature}", but mesh provides "${mesh.layoutSignature}".`);
  }
  ```

---

## 7. Hardware Quirks, Constraints, and Bypass Strategies

### 1. Vertex Texture Fetch (VTF) Derivative Invalidation
- **Hardware Quirk**: Screen-space derivatives (`dpdx`, `dpdy`) do not exist during vertex execution because vertices are processed as isolated points prior to triangle rasterization.
- **Restriction**: Calling standard `textureSample(texture, sampler, uv)` inside `vs_main` results in a fatal shader compilation error in WGSL.
- **Bypass Strategy**: When `TextureSampleNode` executes in the vertex stage, the compiler automatically substitutes explicit Level-of-Detail (LOD) sampling:
  ```wgsl
  textureSampleLevel(t_tex, s_tex, uv, 0.0)
  ```
  Or coordinate indexing via `textureLoad(t_tex, coords, 0)`.

### 2. 4-Byte Buffer Alignment & Offset Padding
- **Hardware Quirk**: WebGPU mandates that `arrayStride` must be a multiple of 4 bytes. Attribute offsets must align to their format's component unit (e.g. 4 bytes for `float32`, 2 bytes for `uint16`).
- **Restriction**: Misaligned layouts trigger pipeline creation errors: `offset must be a multiple of format alignment`.
- **Bypass Strategy**: The attribute chain automatically calculates alignment padding between elements and pads the final `arrayStride` up to the next 4-byte boundary.

### 3. Inter-Stage Location Caps
- **Hardware Quirk**: WebGPU standard guarantees support for at least 16 vertex input locations (`maxVertexAttributes = 16`) and 16 user-defined inter-stage variables (`maxInterStageShaderVariables = 16`).
- **Restriction**: Over-allocating varyings or vertex inputs causes pipeline creation failure on lower-tier hardware.
- **Bypass Strategy**: The compiler tracks allocated `@location(i)` counters. If count exceeds 14, the diagnostic collector records an error code (`ERR_INTERSTAGE_CAPACITY_EXCEEDED`), recommending vector packing (e.g. combining two `vec2` attributes into one `vec4`).

### 4. Anonymous Order Sensitivity
- **Hardware Quirk**: In the absence of semantic names, the physical order of data in the buffer must strictly match the order declared by the shader chain.
- **Bypass Strategy**: The layout signature catches any ordering discrepancies before data reaches the GPU. Ingestion loaders (e.g. `glb.ts`) map semantic source fields (glTF `POSITION`, `NORMAL`) to the target signature during asset import.

---

## 8. Ingestion & Compatibility Profiles

To ensure convenience for standard 3D models while retaining raw flexibility, standard composite macros are provided:

```typescript
// Standard static layout: position (12B) + normal (12B) + uv (8B) = 32B
export const STANDARD_LAYOUT = "f32x3,f32x3,f32x2";

// Standard skinned layout: position (12B) + normal (12B) + uv (8B) + joints (16B) + weights (16B) = 64B
export const SKINNED_LAYOUT = "f32x3,f32x3,f32x2,u32x4,f32x4";
```

Convenience macro methods expand standard configurations in a single call:

```typescript
// Expands the 3 chained attribute nodes internally
const { position, normal, uv } = circuit.addStandardMeshInput();
```

---

## 9. Implementation Roadmap

1. **Phase 1: Component Refactor (`ShaderCmp`)** [Completed]:
   - Created `shadercmp.ts` with `ShaderCmp`, `ShaderParamRecord`, and `ShaderSlot`.
   - Migrated all modules from `MaterialCmp` to `ShaderCmp`.
   - Updated `renderer.ts`, `glb.ts`, and root exports.

2. **Phase 2: Chained Attribute Nodes (`WeebRender/shader/nodes/vertex.ts`)**:
   - Implement `InputVertexAttributeNode` with `.chain(next)` chaining methods.
   - Implement `OutputClipspaceNode` (accepting clip-space `vec4` or auto-transforming local `vec3`).
   - Implement `TransformPositionNode` for standard camera and object matrix multiplication.

3. **Phase 3: Dual-Stage Topological Code Generator (`WeebRender/wgpu/wgsl.ts`)**:
   - Implement stage partitioning (`vertex` vs `fragment`).
   - Implement implicit varying promotion and `struct VertexOutput` generation.
   - Route `textureSampleLevel(..., 0.0)` for vertex-stage texture samplers.

4. **Phase 4: Dynamic Hardware Layout Binding (`wshader.ts` & `renderer.ts`)**:
   - Derive `GPUVertexBufferLayout` directly from the circuit's attribute chain.
   - Derive `layoutSignature` strings for `Mesh` and `GpuShader`.
   - Enforce `mesh.layoutSignature === shader.layoutSignature` in `renderer.ts`.

5. **Phase 5: First-Class Skeletal Skinning Node (`RigVertexNode`)**:
   - Implement `RigVertexNode` consuming `pos`, `joints`, and `weights`.
   - Remove hardcoded `codeSkinned` branches and `stride === 64` checks from `wshader.ts` and `renderer.ts`.
