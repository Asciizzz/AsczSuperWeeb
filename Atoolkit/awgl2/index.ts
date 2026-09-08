// Backend
import { Backend } from "./backend.js";
export { Backend };
export type { Awgl2BackendOptions, ResizeOptions } from "./backend.js";
export default Backend;

// Context type
export type {
    Awgl2Ctx,
    Awgl2IndexBufferEntry,
    Awgl2TextureEntry,
} from "./ctx.js";

// Low-Level WebGL2 Resource Utilities
export {
    createBuffer,
    createProgram,
    createVao,
    createTexture2D,
    createFramebuffer,
} from "./utils.js";
export type {
    CreateGlBufferOptions,
    CreateProgramOptions,
    CreateVaoOptions,
    CreateGlTexture2DOptions,
    CreateGlFramebufferOptions,
    VertexAttributePointer,
} from "./utils.js";

// Lifecycle
export { BeginFrame, EndFrame } from "./cmps/frame.js";

// Passes
export { RenderPass, EndPass } from "./cmps/pass.js";
export type { RenderPassData, ScissorRect } from "./cmps/pass.js";

// Pipeline
export { UseProgram } from "./cmps/program.js";

// Buffers
export { SetBuffers } from "./cmps/buffers.js";
export type {
    VertexBufferEntry,
    IndexBufferEntry,
    SetBuffersData,
} from "./cmps/buffers.js";

// Textures
export { SetTextures } from "./cmps/textures.js";
export type { TextureEntry } from "./cmps/textures.js";

// Uniforms
export { SetUniforms } from "./cmps/uniforms.js";
export type { UniformEntry, UniformType } from "./cmps/uniforms.js";

// Draw
export { Draw, DrawIndexed } from "./cmps/draw.js";
export type { DrawData, DrawIndexedData } from "./cmps/draw.js";
