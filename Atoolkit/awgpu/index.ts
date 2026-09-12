// ================================================================
//  Awgpu - Domain-Agnostic WebGPU Hardware Execution Engine
// ================================================================

// 1. Hardware Device & Canvas Presentation
export {
    AwgpuDevice,
    AwgpuDevice as Backend,
    AwgpuDevice as Device,
    type AwgpuDeviceOptions,
} from "./device.js";

// 2. Targets, Textures & Samplers
export {
    AwgpuTexture,
    AwgpuTexture as Texture,
    AwgpuSampler,
    AwgpuSampler as Sampler,
    AwgpuRenderTarget,
    AwgpuRenderTarget as RenderTarget,
    type AwgpuColorAttachmentConfig,
    type AwgpuDepthAttachmentConfig,
} from "./target.js";

// 3. Buffers & Memory Pools
export {
    AwgpuBuffer,
    AwgpuBuffer as Buffer,
    AwgpuBufferPool,
    AwgpuBufferPool as BufferPool,
    type AwgpuBufferData,
} from "./buffer.js";

// 4. Layouts & Bind Group Frequency Slots
export {
    AwgpuBindSlot,
    AwgpuBindSlot as BindSlot,
    AwgpuBindGroupLayoutBuilder,
    AwgpuBindGroupLayoutBuilder as BindGroupLayoutBuilder,
    AwgpuBindGroup,
    AwgpuBindGroup as BindGroup,
    type AwgpuBindingEntry,
    type AwgpuResourceBinding,
} from "./layout.js";

// 5. Pipelines & Shader Modules
export {
    createVertexLayout,
    AwgpuRenderPipeline,
    AwgpuRenderPipeline as RenderPipeline,
    AwgpuComputePipeline,
    AwgpuComputePipeline as ComputePipeline,
    type AwgpuVertexAttributeDesc,
    type AwgpuRenderPipelineDescriptor,
} from "./pipeline.js";

// 6. Passes & Command Batches
export {
    AwgpuPass,
    AwgpuPass as Pass,
    AwgpuComputePass,
    AwgpuComputePass as ComputePass,
    type AwgpuDrawCommand,
    type AwgpuComputeCommand,
} from "./pass.js";

// 7. Frame Orchestration
export {
    AwgpuFrame,
    AwgpuFrame as Frame,
} from "./frame.js";
