# Atoolkit - Atk

A pretty massive TypeScript toolkit for various stuff.
"A" stands for Asciiz, which is my username btw, hello.

---

## Packages

| Package | Purpose | Dokta |
| :--- | :--- | :--- |
| **[`Atoolkit/acmp`](./acmp/ReadMe.md)** | Atomic execution component primitive (`exec(ctx, diag): void`) operating against mutable contexts | [ReadMe](./acmp/ReadMe.md) |
| **[`Atoolkit/aecs`](./aecs/ReadMe.md)** | Allocation-free Entity Component System built on `Acmp` with sparse sets and O(1) signature queries | [ReadMe](./aecs/ReadMe.md) |
| **[`Atoolkit/agraph`](./agraph/ReadMe.md)** | Pure directed graph structure with Kahn's topological sort, node/edge extraction, and DAG/Tree validation | [ReadMe](./agraph/ReadMe.md) |
| **[`Atoolkit/acircuit`](./acircuit/ReadMe.md)** | Standalone socket-based computation circuit with extensible `Asocket`s, direct wire indexing, and topological execution | [ReadMe](./acircuit/ReadMe.md) |
| **[`Atoolkit/aflow`](./aflow/ReadMe.md)** | DFS execution engine orchestrating `Acmp` arrays across `Agraph` nodes with deterministic edge ordering and branch reuse | [ReadMe](./aflow/ReadMe.md) |
| **[`Atoolkit/awgpu`](./awgpu/ReadMe.md)** | WebGPU pass steps (`RenderPass`, `UsePipeline`, `DrawIndexed`) and buffer/texture/layout resource helpers | [ReadMe](./awgpu/ReadMe.md) |
| **[`Atoolkit/awgl2`](./awgl2/ReadMe.md)** | WebGL2 pass steps (`RenderPass`, `UseProgram`, `SetUniforms`) and buffer/program/VAO helpers | [ReadMe](./awgl2/ReadMe.md) |
| **[`Atoolkit/alm`](./alm/ReadMe.md)** | 3D math (`Mat4`, `Vec2/3/4`, `Quat`) supporting WebGPU [0, 1] clip space, in-place rotations, and zero-allocation calls | [ReadMe](./alm/ReadMe.md) |
| **[`Atoolkit/adiag`](./adiag/ReadMe.md)** | Structured diagnostic collector, telemetry bus, and causal reference chaining via `ref` pointers | [ReadMe](./adiag/ReadMe.md) |
| **[`Atoolkit/adoc`](./adoc/Adoc.ts)** | String compiler with staged replacement rules (idk why this exist ngl) | [Adoc.ts](./adoc/Adoc.ts) |

---