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
export { BeginFrame, EndFrame } from "./steps/frame.js";

// Passes
export { RenderPass, EndPass } from "./steps/pass.js";
export type { RenderPassData, ScissorRect } from "./steps/pass.js";

// Pipeline
export { UseProgram } from "./steps/program.js";

// Buffers
export { SetBuffers } from "./steps/buffers.js";
export type {
    VertexBufferEntry,
    IndexBufferEntry,
    SetBuffersData,
} from "./steps/buffers.js";

// Textures
export { SetTextures } from "./steps/textures.js";
export type { TextureEntry } from "./steps/textures.js";

// Uniforms
export { SetUniforms } from "./steps/uniforms.js";
export type { UniformEntry, UniformType } from "./steps/uniforms.js";

// Draw
export { Draw, DrawIndexed } from "./steps/draw.js";
export type { DrawData, DrawIndexedData } from "./steps/draw.js";
