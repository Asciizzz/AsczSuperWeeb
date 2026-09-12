# Atoolkit - Atk

A pretty massive TypeScript toolkit for various stuff.
"A" stands for Asciiz, which is my username btw, hello.

This toolkit acts as foundation for any libraries, projects, etc. to create common ecosystem of tools, components, and utilities. This allows projects to be modular, composable, and shockingly crosslib-compatible despite not having any fuck with each other.

---

## Packages

| Package | Purpose | Docs |
| :--- | :--- | :--- |
| **[`aecs`](./aecs/ReadMe.md)** | Sparse-set Entity Component System with O(1) signature queries and direct traversal | [ReadMe](./aecs/ReadMe.md) |
| **[`acircuit`](./acircuit/ReadMe.md)** | Socket-based computation circuit with typed endpoints, topological ordering, and order caching | [ReadMe](./acircuit/ReadMe.md) |
| **[`awgpu`](./awgpu/ReadMe.md)** | Domain-agnostic WebGPU execution engine with multi-pass targets, 4-tier bind frequency slots, and command pipeline sequencing | [ReadMe](./awgpu/ReadMe.md) |
| **[`alm`](./alm/ReadMe.md)** | 3D math (`Mat4`, `Vec2/3/4`, `Quat`) supporting WebGPU [0, 1] clip space, in-place rotations, and zero-allocation calls | [ReadMe](./alm/ReadMe.md) |
| **[`adiag`](./adiag/ReadMe.md)** | Structured diagnostic collector, telemetry bus, and causal reference chaining via `ref` pointers | [ReadMe](./adiag/ReadMe.md) |

---