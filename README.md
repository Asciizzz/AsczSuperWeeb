# AsczSuperWeeb

TypeScript computational toolkit and graphics architecture providing cache-coherent data structures, sparse-set ECS, allocation-free math, and domain-agnostic WebGPU execution.

Repository centers primarily on `Atoolkit`, modular foundation for high-performance applications, with legacy modules preserved in `_old/` and experimental rendering abstractions in `WeebRender/`.

---

## Atoolkit Packages

`Atoolkit` provides zero-dependency building blocks designed for composability and raw hardware throughput:

| Package | Role | Key Capabilities | Documentation |
| :--- | :--- | :--- | :--- |
| **[`acmp`](./Atoolkit/acmp/ReadMe.md)** | Execution Component | Atomic execution unit (`exec(ctx, diag): TRet`) operating on mutable contexts with zero control-flow overhead. | [acmp ReadMe](./Atoolkit/acmp/ReadMe.md) |
| **[`aecs`](./Atoolkit/aecs/ReadMe.md)** | Entity Component System | Sparse-set ECS with contiguous dense typed storage, O(1) mutations, and direct set intersection joins (`join2`, `join3`). | [aecs ReadMe](./Atoolkit/aecs/ReadMe.md) |
| **[`acircuit`](./Atoolkit/acircuit/ReadMe.md)** | Value Computation Circuit | Directed computation circuit with typed socket endpoints, 1-to-N fan-out, Kahn topological sorting, and dependency caching. | [acircuit ReadMe](./Atoolkit/acircuit/ReadMe.md) |
| **[`awgpu`](./Atoolkit/awgpu/ReadMe.md)** | Hardware WebGPU Engine | Domain-agnostic GPU execution engine featuring multi-pass render targets, 4-tier frequency bind slots, automated vertex strides, and depth-only pipelines. | [awgpu ReadMe](./Atoolkit/awgpu/ReadMe.md) |
| **[`alm`](./Atoolkit/alm/ReadMe.md)** | 3D Linear Algebra | Native `Float32Array` vectors and matrices (`Mat4`, `Vec2/3/4`, `Quat`) supporting WebGPU [0, 1] clip space and out-parameter zero-allocation operations. | [alm ReadMe](./Atoolkit/alm/ReadMe.md) |
| **[`adiag`](./Atoolkit/adiag/ReadMe.md)** | Diagnostic Telemetry Bus | Structured diagnostics bus with circular ring buffer logging, templated message compilation, and pointer-based causal error chaining (`ref`). | [adiag ReadMe](./Atoolkit/adiag/ReadMe.md) |

---

## Repository Structure

* `Atoolkit/`: Production toolkit modules
  * `acmp/`: Atomic execution component primitive
  * `aecs/`: Sparse-set Entity Component System
  * `acircuit/`: Socket-based computation circuit
  * `alm/`: Allocation-free 3D linear algebra
  * `awgpu/`: Hardware WebGPU execution engine
  * `adiag/`: Diagnostic collector and causal trace bus
* `WeebRender/`: Experimental graphics library built on toolkit primitives
* `_old/`: Archived legacy modules preserved for reference (`aflow`, `agraph`, `awgl2`, legacy `awgpu`)
* `prototypes/`: Interactive testbeds and runnable demonstrations
  * `AwgpuShadowDemo/`: Multi-pass hardware shadow mapping with PCF comparison filtering
  * `Akettle/`: Asset storage and ECS inspection workbench

---

## Core Engineering Principles

1. **Zero-Allocation Math Hot-Paths**:
   * All functions in `alm` write directly into destination buffers passed via `out` arguments (`Mat4.mul(viewProj, model, out)`), eliminating garbage collection pressure during 60+ FPS simulation loops.

2. **Cache-Coherent Sparse Storage**:
   * `aecs` splits entity data into dense typed arrays (`ComponentSet`, `FloatSet`). Iteration runs through sequential, contiguous memory blocks rather than pointer-chasing scene graphs.

3. **4-Tier GPU Bind Frequency Organization**:
   * `awgpu` arranges GPU state into four standard frequency tiers (`Pass = 0`, `Phase = 1`, `Material = 2`, `Instance = 3`), eliminating redundant driver state changes during high-density multi-object batching.

4. **Isolated Diagnostic Chaining**:
   * Components report errors to `adiag` without throwing exceptions across subsystem boundaries. Causal reference pointers (`ref`) preserve root cause traces across complex asynchronous pipelines.

---

## Getting Started

### Prerequisites

* Node.js (version 18 or later)
* WebGPU-capable browser (Google Chrome 113+, Microsoft Edge 113+, or Firefox Nightly with WebGPU enabled)

### Installation

```bash
npm install
```

### Verification

Run TypeScript compilation checks:

```cmd
cmd /c npx tsc --noEmit
```

Run Vite production build:

```cmd
cmd /c npx vite build
```

---

## License

Academic and research evaluation license. All rights reserved.
