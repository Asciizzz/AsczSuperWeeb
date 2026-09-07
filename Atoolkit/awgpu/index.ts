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
export { BeginFrame, EndFrame } from "./steps/frame.js";

// Passes
export { RenderPass, ComputePass, EndPass } from "./steps/pass.js";
export type { RenderPassData, ComputePassData } from "./steps/pass.js";

// Pipeline & Binding
export { UsePipeline }   from "./steps/pipeline.js";
export { SetBindGroups } from "./steps/bind.js";
export type { BindGroupEntry } from "./steps/bind.js";

// Buffers
export { SetBuffers } from "./steps/buffers.js";
export type {
    VertexBufferEntry,
    IndexBufferEntry,
    IndirectBufferEntry,
    SetBuffersData,
} from "./steps/buffers.js";

// Draw
export { Draw, DrawIndexed, DrawIndirect, DrawIndexedIndirect } from "./steps/draw.js";
export type { DrawData, DrawIndexedData, DrawIndirectData }     from "./steps/draw.js";

// Compute
export { Dispatch, DispatchIndirect } from "./steps/dispatch.js";
export type { DispatchData, DispatchIndirectData } from "./steps/dispatch.js";

// Memory copies
export {
    CopyBufferToBuffer,
    CopyBufferToTexture,
    CopyTextureToBuffer,
    CopyTextureToTexture,
} from "./steps/copy.js";
export type {
    CopyBufferToBufferData,
    CopyBufferToTextureData,
    CopyTextureToBufferData,
    CopyTextureToTextureData,
} from "./steps/copy.js";
