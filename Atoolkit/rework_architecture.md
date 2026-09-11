# Atoolkit Rework Architecture

## Purpose

Atoolkit is a collection of agnostic mechanisms for storing data, executing operations, computing values, reporting diagnostics, and communicating with specific hardware APIs.

The toolkit does not define the domain meaning of the data or operations built with it. Terms such as mesh, material, scene, camera, renderer, physics object, hierarchy, and game object do not belong in the general Atoolkit model.

The dependency direction is:

```text
Atoolkit primitives
        ^
        |
External systems built from Atoolkit
```

Atoolkit provides mechanisms. External systems provide interpretation.

## Core Structure

```text
Atoolkit
├── Acmp       executable operation contract
├── Adiag      structured diagnostics
├── Aecs       persistent data-oriented state
├── Acircuit   stateless value computation
├── Alm        numerical primitives
├── Awgpu      independent WebGPU toolkit
└── Awgl2      independent WebGL2 toolkit
```

Each module owns one type of responsibility. No module needs a central engine, scene hierarchy, or universal object model.

## Acmp

`Acmp` is the executable operation primitive.

```typescript
export class Acmp<TCtx = unknown, TRet = void> {
    exec(ctx: TCtx, diag?: Adiag): TRet;
}
```

An `Acmp` receives a context, performs one operation, and optionally records diagnostics. The context belongs to the caller and may describe any execution environment.

Components can be placed in a flat array:

```typescript
for (const component of components) {
    component.exec(ctx, diag);
}
```

The array owns execution order. `Acmp` does not own scheduling, hierarchy, persistence, or application state.

`Acmp` supports both function-like operations and stateful operations. Any state required by a specific operation belongs to that derived component, not to the base abstraction.

## Adiag

`Adiag` records structured operation results.

```typescript
interface AdiagResult {
    type: string;
    code: string;
    raw: string;
    data: unknown;
    ref?: AdiagResult | null;
}
```

Diagnostics provide:

- success, error, warning, and information records
- causal references between results
- message interpolation
- bounded history
- result filtering

Diagnostics describe operation outcomes. They do not define a domain-specific error hierarchy.

## Aecs

`Aecs` stores persistent data in entity-indexed component sets.

```text
Entity
├── Component
├── Component
└── Component
```

An entity is an identifier associated with arbitrary component instances. A component is data owned by the entity registry.

External systems query component combinations and operate over the matching entities:

```typescript
for (const [entity, primary] of ecs.query(PrimaryCmp)) {
    const secondary = ecs.get(entity, SecondaryCmp);
    if (!secondary) continue;

    // Operate on the component data.
}
```

The registry does not know what a component means. Components may represent state for any external system.

The important contract is data locality:

- persistent state lives in components
- systems query the state they understand
- systems update component data
- entities do not own system behavior
- systems do not own the entity registry

This permits new systems to be added without changing the ECS core.

## Acircuit

`Acircuit` describes stateless value computation through socket connections.

```text
input socket: 1-to-1
output socket: 1-to-N
node process: inputs -> outputs
```

A node declares endpoints and implements one computation method:

```typescript
abstract class Acnode {
    readonly inputs: Map<string, Asocket>;
    readonly outputs: Map<string, Asocket>;

    abstract process(
        inputs: Record<string, unknown>,
        ctx?: ProcessCtx
    ): Record<string, unknown>;
}
```

Nodes do not cache input or output values. The circuit owns topology and keeps intermediate values local to a single run.

Persistent state is explicit. If a specialized node needs state, that node owns it deliberately. The base circuit does not turn every socket into a hidden storage location.

`Acircuit` provides:

- node registration
- socket validation
- 1-to-1 input wiring
- 1-to-N output fan-out
- connection replacement
- cycle detection
- topological ordering
- run-local value resolution
- execution callbacks

The circuit has no domain interpretation. It computes values; the caller decides what those values represent.

## Alm

`Alm` provides numerical data types and operations using compact typed-array representations.

```typescript
type V3 = Float32Array;
type M16 = Float32Array;
```

The math layer focuses on:

- vectors
- quaternions
- matrices
- transforms
- projections
- interpolation
- allocation-aware output parameters

`Alm` does not define a scene, object, entity, camera, or transform component. Those meanings belong to a higher layer.

## Awgpu and Awgl2

`Awgpu` and `Awgl2` remain independent because WebGPU and WebGL2 are different APIs with different resource models, capabilities, and execution rules.

They should share naming patterns only where the concepts genuinely overlap. They should not be forced into one universal backend hierarchy or one lowest-common-denominator implementation.

### Awgpu

`Awgpu` provides WebGPU-specific operations and state:

- `GPUDevice`
- `GPUQueue`
- `GPUCommandEncoder`
- render passes
- compute passes
- bind groups
- GPU buffers
- GPU textures
- render pipelines
- compute pipelines
- draw commands
- dispatch commands
- copy commands
- indirect operations

Its context represents WebGPU command recording state:

```typescript
interface AwgpuCtx {
    device: GPUDevice | null;
    queue: GPUQueue | null;
    encoder: GPUCommandEncoder | null;
    pass: GPURenderPassEncoder | GPUComputePassEncoder | null;
    passKind: "render" | "compute" | null;
    ended: boolean;
}
```

Compute is a natural part of `Awgpu` because WebGPU exposes compute pipelines and dispatch operations directly.

### Awgl2

`Awgl2` provides WebGL2-specific operations and state:

- `WebGL2RenderingContext`
- programs
- vertex array objects
- buffers
- textures
- framebuffers
- uniforms
- draw commands
- raster state

WebGL2-specific limitations and lifecycle rules should remain visible instead of being hidden behind a generic graphics interface.

## Removed Core Direction

`Aflow` and `Agraph` are not part of the new core execution direction.

The old model gave graph objects and orchestrators too much control over execution. The new model favors:

```text
persistent ECS data
+ external system queries
+ explicit flat component arrays
```

Graph storage and traversal may still be useful as isolated utilities in the future, but they should not define the ownership or scheduling model of Atoolkit.

A system that needs ordered operations can use a flat array:

```typescript
const operations: Acmp<Context>[] = [
    first,
    second,
    third,
];

for (const operation of operations) {
    operation.exec(ctx, diag);
}
```

This keeps execution visible, local, and easy to modify.

## External Systems

External systems are built from Atoolkit. They are not part of Atoolkit's generic vocabulary.

A system generally has three responsibilities:

1. query the data it understands
2. perform its operation
3. write results back to data or an explicit execution context

For example, a system may query entities containing a particular component combination, calculate a result using `Alm`, and update another component. A hardware-oriented system may record operations through `Awgpu` or `Awgl2`.

The system owns its domain vocabulary. Atoolkit owns the reusable mechanism.

## Dependency Direction

Dependencies should point toward lower-level mechanisms:

```text
External domain system
        |
        v
Aecs / Acircuit / Acmp / Alm / Adiag
        |
        v
Language and platform primitives
```

A lower-level module should not describe itself through a higher-level consumer. In particular:

- `Aecs` should not mention rendering or physics.
- `Acircuit` should not mention shader graphs or graphics.
- `Acmp` should not prescribe a frame loop.
- `Alm` should not define scene transforms.
- `Adiag` should not define domain error categories.
- `Awgpu` and `Awgl2` may describe their native graphics APIs because hardware graphics is their direct scope.

## Design Principles

1. Keep Atoolkit domain-agnostic.
2. Store persistent state in ECS components.
3. Execute operations through explicit `Acmp` components.
4. Keep computation graphs stateless and run-local.
5. Use flat arrays when explicit order is sufficient.
6. Keep WebGPU and WebGL2 independent.
7. Expose backend differences instead of erasing them.
8. Keep ownership with the layer that understands the data.
9. Avoid abstract bases that exist only to unify unrelated concepts.
10. Prefer small concrete contracts over universal engine objects.
11. Keep optional state explicit and locally owned.
12. Let external systems define domain meaning.

## Target Shape

```text
Atoolkit
  Acmp       operations
  Adiag      diagnostics
  Aecs       data storage
  Acircuit   value computation
  Alm        mathematics
  Awgpu      WebGPU operations
  Awgl2      WebGL2 operations

External systems
  query Aecs
  compute with Acircuit or Alm
  execute with Acmp
  record hardware work through Awgpu or Awgl2
```

Atoolkit is complete when it provides strong reusable mechanisms without requiring the user to adopt a particular engine architecture or domain model.
