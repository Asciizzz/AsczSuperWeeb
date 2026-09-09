# Execution Components

WebGL2 component classes for `Atoolkit/awgl2`, extending `Acmp<Awgl2Ctx>` to execute against mutable frame contexts:

---

## Execution Model

Every component executes directly against the frame context:

```ts
cmp.exec(ctx, diag);
```

- `ctx`: Mutable `Awgl2Ctx` created per frame via `backend.newCtx()`.
- `diag`: Optional `Adiag` collector for errors and telemetry.

---

## 1. Frame Lifecycle Components

### `BeginFrame`
```ts
new BeginFrame()
```

- Resets per-frame context state: empties vertex/texture mappings, clears active program/VAO/framebuffer handles, and sets `ended = false`.

### `EndFrame`
```ts
new EndFrame()
```

- Flushes the WebGL command queue via `ctx.gl.flush()` and sets `ctx.ended = true`.

---

## 2. Pass Components

### `RenderPass`
```ts
new RenderPass(data?: RenderPassData)

interface RenderPassData {
    framebuffer?:       WebGLFramebuffer | null;
    width?:             number;
    height?:            number;
    scissor?:           ScissorRect;
    clearColorEnabled?: boolean;
    clearColor?:        [number, number, number, number];
    useDepth?:          boolean;
    clearDepthEnabled?: boolean;
    clearDepth?:        number;
}
```

- **`framebuffer`**: Target framebuffer handle; `null` targets the default canvas backbuffer.
- **`scissor`**: Optional viewport scissor rectangle constraining draw and clear operations.

### `EndPass`
```ts
new EndPass()
```

- Unbinds the active framebuffer to target the canvas default buffer and resets active pass state on `ctx`.

---

## 3. Shaders & Programs

### `UseProgram`
```ts
new UseProgram(program: WebGLProgram | null)
```

- Binds the program via `gl.useProgram(program)` and updates `ctx.program`.

---

## 4. Buffers & Vertex Arrays

### `SetBuffers`
```ts
new SetBuffers(data?: SetBuffersData)

interface SetBuffersData {
    vao?:      WebGLVertexArrayObject | null;
    vertex?:   VertexBufferEntry | VertexBufferEntry[];
    vertices?: VertexBufferEntry | VertexBufferEntry[];
    index?:    IndexBufferEntry | null;
}
```

- **`vao`**: Preconfigured vertex array object; binds attribute pointers and layout directly.
- **`vertex`** / **`index`**: Direct buffer bindings applied when bypassing an existing VAO handle.

---

## 5. Textures & Samplers

### `SetTextures`
```ts
new SetTextures(entries?: TextureEntry[])

interface TextureEntry {
    unit?:    number;
    texture:  WebGLTexture;
    target?:  number;
    uniform?: string;
    program?: WebGLProgram;
}
```

- **`uniform`**: Sampler uniform name on the active program; automatically writes the assigned texture unit index.

---

## 6. Uniforms

### `SetUniforms`
```ts
new SetUniforms(entries?: UniformEntry[])

type UniformType =
    | "1i" | "1f"
    | "2f" | "3f" | "4f"
    | "1iv" | "1fv" | "2fv" | "3fv" | "4fv"
    | "mat2" | "mat3" | "mat4";

type UniformEntry = {
    name:       string;
    program?:   WebGLProgram;
} & (
    | { type: "1i" | "1f"; value: number }
    | { type: "2f" | "3f" | "4f"; value: [number, number, ...number[]] | Float32Array }
    | { type: "1iv"; value: number[] | Int32Array }
    | { type: "1fv" | "2fv" | "3fv" | "4fv"; value: number[] | Float32Array }
    | { type: "mat2" | "mat3" | "mat4"; value: number[] | Float32Array; transpose?: boolean }
);
```

- **`transpose`**: Specifies whether matrix values (`mat2`, `mat3`, `mat4`) are transposed during upload (defaults to `false`).

---

## 7. Draw Commands

### `Draw`
```ts
new Draw(data?: DrawData)

interface DrawData {
    mode?:          number | null; // default: gl.TRIANGLES
    first?:         number;        // default: 0
    firstVertex?:   number;        // alias
    count?:         number;        // default: 0
    vertexCount?:   number;        // alias
    instanceCount?: number;        // default: 0 (triggers non-instanced draw)
}
```

- Dispatches `gl.drawArraysInstanced` or `gl.drawArrays`.

### `DrawIndexed`
```ts
new DrawIndexed(data?: DrawIndexedData)

interface DrawIndexedData {
    mode?:          number | null; // default: gl.TRIANGLES
    count?:         number;        // default: 0
    indexCount?:    number;        // alias
    type?:          number | null; // default: ctx.buffers.index.type
    offset?:        number;        // default: 0
    instanceCount?: number;        // default: 0
}
```

- Dispatches `gl.drawElementsInstanced` or `gl.drawElements`.
