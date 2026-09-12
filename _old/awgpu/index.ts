// Backend
import { Backend } from "./backend.js";
export { Backend };
export default Backend;
export type { AwgpuBackendOptions } from "./backend.js";

// Context type
export type {
    AwgpuCtx,
    AwgpuVertexBufferEntry,
    AwgpuIndexBufferEntry,
    AwgpuIndirectBufferEntry,
    AwgpuBindGroupEntry,
} from "./ctx.js";

// Low-Level WebGPU Resource Utilities
export {
    createBuffer,
    createUniformBuffer,
    createShaderModule,
    createDepthTexture,
    createTexture2D,
    createVertexLayout,
} from "./utils.js";
export type {
    CreateBufferOptions,
    CreateUniformBufferOptions,
    CreateShaderModuleOptions,
    CreateDepthTextureOptions,
    CreateTexture2DOptions,
    VertexAttributeDescriptor,
} from "./utils.js";

// Lifecycle
export {
    BeginFrame,
    EndFrame,
    BeginFrame as FrameStart,
    EndFrame as FrameEnd,
} from "./cmps/frame.js";

// Passes
export { RenderPass, ComputePass, EndPass } from "./cmps/pass.js";
export type { RenderPassData, ComputePassData } from "./cmps/pass.js";

// Pipeline & Binding
export { UsePipeline }   from "./cmps/pipeline.js";
export { SetBindGroups } from "./cmps/bind.js";
export type { BindGroupEntry } from "./cmps/bind.js";

// Buffers
export { SetBuffers } from "./cmps/buffers.js";
export type {
    VertexBufferEntry,
    IndexBufferEntry,
    IndirectBufferEntry,
    SetBuffersData,
} from "./cmps/buffers.js";

// Draw
export { Draw, DrawIndexed, DrawIndirect, DrawIndexedIndirect } from "./cmps/draw.js";
export type { DrawData, DrawIndexedData, DrawIndirectData }     from "./cmps/draw.js";

// Compute
export { Dispatch, DispatchIndirect } from "./cmps/dispatch.js";
export type { DispatchData, DispatchIndirectData } from "./cmps/dispatch.js";

// Memory copies
export {
    CopyBufferToBuffer,
    CopyBufferToTexture,
    CopyTextureToBuffer,
    CopyTextureToTexture,
} from "./cmps/copy.js";
export type {
    CopyBufferToBufferData,
    CopyBufferToTextureData,
    CopyTextureToBufferData,
    CopyTextureToTextureData,
} from "./cmps/copy.js";
