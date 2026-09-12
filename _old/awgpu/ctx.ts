/**
 * The mutable context object representing state for a WebGPU frame.
 * Created each frame via Backend.newCtx().
 */

export interface AwgpuVertexBufferEntry {
    buffer: GPUBuffer;
    offset: number;
    size: number | null;
}

export interface AwgpuIndexBufferEntry {
    buffer: GPUBuffer;
    format: GPUIndexFormat;
    offset: number;
    size: number | null;
}

export interface AwgpuIndirectBufferEntry {
    buffer: GPUBuffer;
    offset: number;
}

export interface AwgpuBindGroupEntry {
    bindGroup: GPUBindGroup;
    offsets: Iterable<number> | null;
}

export interface AwgpuCtx {
    device:     GPUDevice | null;
    queue:      GPUQueue  | null;
    canvas:     HTMLCanvasElement | null;
    canvasCtx:  GPUCanvasContext  | null;
    format:     GPUTextureFormat  | null;

    encoder:    GPUCommandEncoder | null;
    pass:       GPURenderPassEncoder | GPUComputePassEncoder | null;
    passKind:   "render" | "compute" | null;
    pipeline:   GPURenderPipeline | GPUComputePipeline | null;

    buffers: {
        vertex:   Map<number, AwgpuVertexBufferEntry>;
        index:    AwgpuIndexBufferEntry | null;
        indirect: AwgpuIndirectBufferEntry | null;
    };

    bindGroups: Map<number, AwgpuBindGroupEntry>;
    textures:   Map<number, unknown>;
    ended:      boolean;
}
