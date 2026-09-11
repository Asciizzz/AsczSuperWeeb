# AsczSuperWeeb

A modular, zero-allocation reactive dataflow framework and WebGPU rendering engine engineered for high-density architectural digital twins and real-time scientific simulation.

---

## Overview

AsczSuperWeeb is divided into two distinct architectural layers:

1. **`Atoolkit`**: A zero-dependency computational foundation providing cache-conscious data structures, a sparse-set Entity Component System, stateless value circuits, allocation-free linear algebra, and low-level hardware abstractions.
2. **`WeebRender`**: A modern rendering engine built atop `Atoolkit` featuring an AST-driven procedural Shader Graph compiler targeting pure WebGPU Shading Language (WGSL), universal static and skinned mesh vertex pipelines, decoupled render pass execution, and streaming binary glTF/GLB ingestion.

---

## Repository Architecture

```text
AsczSuperWeeb/
├── Atoolkit/
│   ├── acmp/          # Declarative component metadata and bitmask indexing
│   ├── acircuit/      # Stateless socket circuit with topological execution
│   ├── adiag/         # Zero-overhead diagnostic assertions and runtime contracts
│   ├── aecs/          # High-performance cache-coherent Sparse-Set ECS
│   ├── alm/           # Zero-allocation linear algebra (Vec2, Vec3, Vec4, Mat4, Quat)
│   ├── awgl2/         # WebGL2 fallback hardware abstraction
│   └── awgpu/         # WebGPU device wrappers, buffer pools, and bind group managers
└── WeebRender/
    ├── camera.ts      # Projection and view camera abstractions
    ├── loader/        # Asynchronous binary glTF/GLB streaming asset parser
    ├── shadercmp.ts   # Shader component and uniform parameter descriptors
    ├── mesh.ts        # Vertex buffers, submesh ranges, and index topology
    ├── renderer.ts    # Decoupled WebGPU frame renderer and draw call scheduler
    ├── shader/        # Node-based Shader Graph compiler and WGSL generator
    ├── skeleton.ts    # Bone hierarchy and skeletal skinning storage buffers
    ├── texture.ts     # WebGPU texture resources and sampler wrappers
    └── transform.ts   # Spatial transforms and local-to-world matrix propagation
```

---

## Key Features

- **Zero Allocation Philosophy**: Mathematical operations in `alm` use out-parameter conventions (`add(out, a, b)`), eliminating heap object churn and garbage collection pauses during animation and simulation loops.
- **Cache-Coherent Entity Component System**: `aecs` employs sparse-set indexing with dense TypedArray storage, delivering O(1) component additions/removals and linear contiguous iteration for 100,000+ entities.
- **Topological DAG Scheduling**: `aflow` orders simulation passes, transform evaluations, and render passes deterministically without manual ordering bugs.
- **Universal Dual-Stride Shaders**: Shaders authored via `WeebRender/shader` automatically emit dual vertex pipeline entry points (`vs_static` with 32-byte stride, `vs_skinned` with 64-byte stride), allowing identical shader graphs to render static and animated meshes seamlessly.
- **Direct WebGPU Target**: Native WGSL shader emission and command buffer recording without legacy wrapper overhead.

---

## Quirks

The "Weeb" is the name is like an inside joke, Web, Weeb, get it?

---

## Getting Started

### Prerequisites

- Node.js (version 18 or later recommended)
- A browser supporting WebGPU (Google Chrome 113+, Microsoft Edge 113+)

### Installation

```bash
npm install
```

### Type Checking

```bash
npx tsc --noEmit
```

---

## License

Academic and research evaluation license. All rights reserved.
