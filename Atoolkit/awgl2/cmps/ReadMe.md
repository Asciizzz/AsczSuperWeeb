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
- Action: Resets per-frame state: clears vertex/texture maps, nullifies program/VAO/framebuffer handles, and sets `ended = false`.

### `EndFrame`
```ts
new EndFrame()
```
- Action: Flushes command queue via `ctx.gl.flush()` and sets `ctx.ended = true`.

---

## 2. Pass Components

### `RenderPass`
```ts
new RenderPass(data?: RenderPassData)

interface RenderPassData {
    framebuffer?:       WebGLFramebuffer | null;          // null targets canvas default backbuffer
    width?:             number;                           // Viewport width (defaults to canvas width)
    height?:            number;                           // Viewport height (defaults to canvas height)
    scissor?:           ScissorRect;                      // Optional scissor test
    clearColorEnabled?: boolean;                          // Clear color flag (default: true)
    clearColor?:        [number, number, number, number]; // [r, g, b, a] (default: [0, 0, 0, 1])
    useDepth?:          boolean;                          // Enable depth test (default: true)
    clearDepthEnabled?: boolean;                          // Clear depth flag (default: true)
    clearDepth?:        number;                           // Clear depth value (default: 1.0)
}

interface ScissorRect {
    x?:      number; // default: 0
    y?:      number; // default: 0
    width?:  number; // default: viewport width
    height?: number; // default: viewport height
}
```
- Action: Binds framebuffer, configures viewport/scissor rectangles, and executes clear operations.

### `EndPass`
```ts
new EndPass()
```
- Action: Unbinds framebuffer (`gl.bindFramebuffer(gl.FRAMEBUFFER, null)`) and resets pass/framebuffer/program handles.

---

## 3. Shaders & Programs

### `UseProgram`
```ts
new UseProgram(program: WebGLProgram | null)
```
- Action: Binds program via `gl.useProgram(program)` and updates `ctx.program`.

---

## 4. Buffers & Vertex Arrays

### `SetBuffers`
```ts
new SetBuffers(data?: SetBuffersData)

interface SetBuffersData {
    vao?:      WebGLVertexArrayObject | null;
    vertex?:   VertexBufferEntry | VertexBufferEntry[];
    vertices?: VertexBufferEntry | VertexBufferEntry[]; // alias
    index?:    IndexBufferEntry | null;
}

interface VertexBufferEntry {
    slot?:   number;      // Attribute slot index (default: 0)
    buffer:  WebGLBuffer; // Raw VBO
    offset?: number;      // Byte offset
}

interface IndexBufferEntry {
    buffer: WebGLBuffer; // Raw EBO
    type?:  number;      // gl.UNSIGNED_SHORT or gl.UNSIGNED_INT (default: gl.UNSIGNED_SHORT)
}
```
- Action: Binds VAO and attaches optional vertex/index buffers.

---

## 5. Textures & Samplers

### `SetTextures`
```ts
new SetTextures(entries?: TextureEntry[])

interface TextureEntry {
    unit?:    number;          // Texture unit index (0 for gl.TEXTURE0)
    texture:  WebGLTexture;    // WebGL texture instance
    target?:  number;          // Texture target (default: gl.TEXTURE_2D)
    uniform?: string;          // Sampler uniform name on active program
    program?: WebGLProgram;    // Optional program override
}
```
- Action: Activates texture unit, binds texture, and updates sampler uniform if provided.

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
    program?:   WebGLProgram; // default: ctx.program
} & (
    | { type: "1i" | "1f"; value: number }
    | { type: "2f" | "3f" | "4f"; value: [number, number, ...number[]] | Float32Array }
    | { type: "1iv"; value: number[] | Int32Array }
    | { type: "1fv" | "2fv" | "3fv" | "4fv"; value: number[] | Float32Array }
    | { type: "mat2" | "mat3" | "mat4"; value: number[] | Float32Array; transpose?: boolean }
);
```
- Action: Resolves uniform locations and invokes corresponding `gl.uniform*` setters.

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
- Action: Dispatches `gl.drawArraysInstanced` or `gl.drawArrays`.

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
- Action: Dispatches `gl.drawElementsInstanced` or `gl.drawElements`.
