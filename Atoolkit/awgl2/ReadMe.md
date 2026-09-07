# Awgl2

WebGL2 resource utilities and modular execution components.

---

## Core Characteristics

- **Direct WebGL2 Access**: Direct interaction with WebGL2 programs, VAOs, textures, and framebuffers without material abstractions.
- **Diagnostic Logging**: Failures return null and log structured records to `Adiag`.
- **State-Preserving Context**: Tracks bound programs, active VAOs, and framebuffers on `Awgl2Ctx`.
- **Atomic Step Execution**: Passes, shaders, uniforms, and draw calls execute as atomic `Acmp` steps via `exec(ctx, diag)`.

---

## Quick Start

```ts
import { Adiag } from "../adiag/index.js";
import {
    Backend,
    createBuffer,
    createProgram,
    createVao,
    BeginFrame,
    RenderPass,
    UseProgram,
    SetBuffers,
    SetUniforms,
    DrawIndexed,
    EndPass,
    EndFrame,
} from "../awgl2/index.js";

const diag = new Adiag();

// 1. Initialize Backend
const backend = await Backend.create(canvasElement);
const gl = backend.gl!;

// 2. Compile Shader Program
const program = createProgram(gl, {
    vs: `#version 300 es
    layout(location = 0) in vec3 a_position;
    uniform mat4 u_viewProj;
    void main() {
        gl_Position = u_viewProj * vec4(a_position, 1.0);
    }`,
    fs: `#version 300 es
    precision highp float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(0.2, 0.8, 0.4, 1.0);
    }`,
    diag,
})!;

// 3. Create Buffers & VAO
const vbo = createBuffer(gl, {
    target: gl.ARRAY_BUFFER,
    data: new Float32Array([...]),
    usage: gl.STATIC_DRAW,
    diag,
})!;

const ibo = createBuffer(gl, {
    target: gl.ELEMENT_ARRAY_BUFFER,
    data: new Uint16Array([...]),
    usage: gl.STATIC_DRAW,
    diag,
})!;

const vao = createVao(gl, {
    attributes: [{
        buffer: vbo,
        attributes: [{ location: 0, size: 3, type: gl.FLOAT }],
    }],
    indexBuffer: ibo,
    diag,
})!;

// 4. Compose Execution Components
const pipeline = [
    new BeginFrame(),
    new RenderPass({
        clearColor: [0.02, 0.02, 0.03, 1.0],
        useDepth: true,
    }),
    new UseProgram(program),
    new SetBuffers({ vao }),
    new SetUniforms([
        { name: "u_viewProj", type: "mat4", value: viewProjMatrix },
        { name: "u_lightPos", type: "3f", value: [0.0, 10.0, 5.0] },
    ]),
    new DrawIndexed({ count: 36 }),
    new EndPass(),
    new EndFrame(),
];

// 5. Frame Loop
function render() {
    const ctx = backend.newCtx();
    for (let i = 0; i < pipeline.length; i++) {
        pipeline[i].exec(ctx, diag);
    }
    requestAnimationFrame(render);
}
render();
```

---

## Utilities

### `createBuffer(gl, options)`
Allocates and initializes `WebGLBuffer` with typed data or fixed size.

```ts
const vbo = createBuffer(gl, {
    target: gl.ARRAY_BUFFER,
    data: new Float32Array([...]),
    usage: gl.STATIC_DRAW,
    diag,
});
```

### `createProgram(gl, options)`
Compiles vertex/fragment shaders and links `WebGLProgram`. On error, logs compilation info to `diag` and cleans up shader handles.

### `createVao(gl, options)`
Allocates `WebGLVertexArrayObject`, binds buffers with configured layout attributes, attaches optional index buffer, and unbinds.

### `createTexture2D(gl, options)`
Allocates 2D `WebGLTexture`, sets filtering parameters, and uploads pixel data.

### `createFramebuffer(gl, options)`
Creates `WebGLFramebuffer`, attaches color textures and depth renderbuffers, and verifies completeness.

---

## Context & Backend

### `Awgl2Ctx`
Context object created per frame by `backend.newCtx()` and passed through every step:

```ts
interface Awgl2Ctx {
    backend:     Backend;
    gl:          WebGL2RenderingContext | null;
    passKind:    "render" | null;
    program:     WebGLProgram | null;
    vao:         WebGLVertexArrayObject | null;
    framebuffer: WebGLFramebuffer | null;

    buffers: {
        vertex: Map<number, WebGLBuffer>;
        index:  Awgl2IndexBufferEntry | null;
    };

    textures: Map<number, Awgl2TextureEntry>;
    ended:    boolean;
}
```

### `Backend`
Initializes WebGL2 on the target canvas and manages resizing:

- `Backend.create(canvas, options)`: Asynchronous factory.
- `backend.init()`: Requests `WebGL2RenderingContext` from canvas.
- `backend.resize(options)`: Synchronizes drawing buffer size with canvas display dimensions.
- `backend.newCtx()`: Allocates fresh `Awgl2Ctx`.
- `backend.getDepthRenderbuffer(width, height)`: Creates or reuses shared depth renderbuffer.
- `backend.destroy()`: Cleans up internal allocations.

---

## Step Components

Detailed signatures for step classes are documented in **[`steps/ReadMe.md`](./steps/ReadMe.md)**:

- **Lifecycle**: `BeginFrame`, `EndFrame`
- **Passes**: `RenderPass`, `EndPass`
- **Programs**: `UseProgram`
- **Buffers**: `SetBuffers` (VAO, VBO, EBO)
- **Textures**: `SetTextures`
- **Uniforms**: `SetUniforms` (Scalar, vector, and matrix types)
- **Draw Commands**: `Draw`, `DrawIndexed`
