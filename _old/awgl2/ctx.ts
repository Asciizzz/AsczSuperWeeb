/**
 * The mutable context object representing state for a WebGL2 frame.
 * Created each frame via Backend.newCtx().
 */
import type { Backend } from "./backend.js";

export interface Awgl2IndexBufferEntry {
    buffer: WebGLBuffer;
    type:   number; // gl.UNSIGNED_SHORT | gl.UNSIGNED_INT
}

export interface Awgl2TextureEntry {
    texture: WebGLTexture;
    target:  number;
}

export interface Awgl2Ctx {
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
