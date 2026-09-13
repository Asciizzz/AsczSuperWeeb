# Atoolkit - Atk

Modular TypeScript computational toolkit providing cache-coherent data structures, sparse-set ECS, allocation-free 3D math, value computation circuits, and domain-agnostic WebGPU execution.

Acts as foundation for applications to create a common ecosystem of tools, components, and utilities that are modular, composable, and cross-compatible without rigid framework coupling.

---

## Packages

| Package | Role | Core Architecture | Docs |
| :--- | :--- | :--- | :--- |
| **[`aecs`](./aecs/ReadMe.md)** | Entity Component System | Sparse-dense storage (`ComponentSet`, `FloatSet`) with O(1) mutations, cache-coherent dense iteration, and dynamic smallest-set intersection joins (`join2`, `join3`). | [aecs ReadMe](./aecs/ReadMe.md) |
| **[`acircuit`](./acircuit/ReadMe.md)** | Value Computation Circuit | Directed computation circuit with typed socket endpoints (`Asocket`), 1-to-N fan-out (`Awire`), Kahn topological ordering, and dependency plan caching. | [acircuit ReadMe](./acircuit/ReadMe.md) |
| **[`awgpu`](./awgpu/ReadMe.md)** | Hardware WebGPU Engine | Domain-agnostic GPU execution engine with multi-pass targets, 4-tier frequency bind slots, automatic vertex strides, command pooling, and redundant state filtering. | [awgpu ReadMe](./awgpu/ReadMe.md) |
| **[`alm`](./alm/ReadMe.md)** | 3D Linear Algebra | Native `Float32Array` vectors and matrices (`Mat4`, `Vec2/3/4`, `Quat`) supporting WebGPU [0, 1] clip space, in-place rotations, and zero-allocation out-parameter calls. | [alm ReadMe](./alm/ReadMe.md) |
| **[`adiag`](./adiag/ReadMe.md)** | Diagnostic Telemetry Bus | Structured diagnostics bus with circular ring buffer history (default 1000 entries), templated message compilation, and pointer-based causal error chaining (`ref`). | [adiag ReadMe](./adiag/ReadMe.md) |

---

## Engineering Invariants

1. **Zero-Allocation Calling Convention**:
   - Math operations in `alm` write directly into destination buffers passed via `out` parameters (`Mat4.mul(viewProj, model, out)`), eliminating garbage collection pressure during simulation and render loops.
2. **Cache-Coherent Sparse Storage**:
   - `aecs` stores component values and entity keys in packed, contiguous arrays (`ComponentSet`, `FloatSet`). Iterations execute directly over dense blocks, avoiding pointer-chasing scene graphs.
3. **4-Tier Bind Frequency Slots**:
   - `awgpu` organizes bindings into standard frequency tiers (`Pass = 0`, `Phase = 1`, `Material = 2`, `Instance = 3`), filtering redundant GPU driver state changes across draw batches.
4. **Causal Reference Chaining**:
   - `adiag` traces root cause failures across subsystem boundaries using non-throwing records linked via causal reference pointers (`ref`), preserving diagnostic context without throwing exceptions across asynchronous barriers.
5. **Topological Plan Caching**:
   - `acircuit` caches topological evaluation plans (`_cachedPlan`) across runs, invalidating execution order only upon explicit graph topology mutations.