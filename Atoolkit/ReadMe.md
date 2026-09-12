# Atoolkit - Atk

A pretty massive TypeScript toolkit for various stuff.
"A" stands for Asciiz, which is my username btw, hello.

---

## Packages

| Package | Purpose | Docs |
| :--- | :--- | :--- |
| **[`acmp`](./acmp/ReadMe.md)** | Atomic execution component primitive (`exec(ctx, diag): void`) operating against mutable contexts | [ReadMe](./acmp/ReadMe.md) |
| **[`aecs`](./aecs/ReadMe.md)** | Sparse-set Entity Component System with O(1) signature queries and direct traversal | [ReadMe](./aecs/ReadMe.md) |
| **[`acircuit`](./acircuit/ReadMe.md)** | Socket-based computation circuit with typed endpoints, topological ordering, and order caching | [ReadMe](./acircuit/ReadMe.md) |
| **[`awgpu`](./awgpu/ReadMe.md)** | WebGPU execution components (`RenderPass`, `UsePipeline`, `DrawIndexed`) and buffer/texture/layout resource helpers | [ReadMe](./awgpu/ReadMe.md) |
| **[`awgl2`](./awgl2/ReadMe.md)** | WebGL2 execution components (`RenderPass`, `UseProgram`, `SetUniforms`) and buffer/program/VAO helpers | [ReadMe](./awgl2/ReadMe.md) |
| **[`alm`](./alm/ReadMe.md)** | 3D math (`Mat4`, `Vec2/3/4`, `Quat`) supporting WebGPU [0, 1] clip space, in-place rotations, and zero-allocation calls | [ReadMe](./alm/ReadMe.md) |
| **[`adiag`](./adiag/ReadMe.md)** | Structured diagnostic collector, telemetry bus, and causal reference chaining via `ref` pointers | [ReadMe](./adiag/ReadMe.md) |

---