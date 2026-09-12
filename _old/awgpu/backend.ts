import type { AwgpuCtx } from "./ctx.js";

// ==================== Types =====================

export interface AwgpuBackendOptions {
    /** Preferred canvas format; defaults to navigator.gpu.getPreferredCanvasFormat() */
    format?:   GPUTextureFormat;
    /** Passed to navigator.gpu.requestAdapter() */
    pickBest?: GPURequestAdapterOptions;
    /** Passed to adapter.requestDevice() */
    device?:   GPUDeviceDescriptor;
    /** Passed to context.configure() */
    context?:  Partial<GPUCanvasConfiguration> & { alphaMode?: GPUCanvasAlphaMode };
}

// ==================== Helpers =====================

function resolveCanvas(canvasRef: string | HTMLCanvasElement | null | undefined): HTMLCanvasElement | null {
    if (!canvasRef) return null;
    if (typeof HTMLCanvasElement !== "undefined" && canvasRef instanceof HTMLCanvasElement) return canvasRef;
    if (typeof canvasRef === "string" && typeof document !== "undefined") {
        const found = document.querySelector(canvasRef);
        if (typeof HTMLCanvasElement !== "undefined" && found instanceof HTMLCanvasElement) return found;
    }
    return null;
}

// ==================== Backend =====================

export class Backend {
    canvas:    HTMLCanvasElement | null = null;
    options:   AwgpuBackendOptions      = {};
    adapter:   GPUAdapter | null        = null;
    device:    GPUDevice  | null        = null;
    queue:     GPUQueue   | null        = null;
    canvasCtx: GPUCanvasContext | null  = null;
    format:    GPUTextureFormat | null  = null;
    ready:     boolean = false;

    constructor(canvas: string | HTMLCanvasElement | null = null, options: AwgpuBackendOptions = {}) {
        this.canvas  = resolveCanvas(canvas);
        this.options = options ?? {};
    }

    static async create(canvas: string | HTMLCanvasElement, options: AwgpuBackendOptions = {}): Promise<Backend> {
        const backend = new Backend(canvas, options);
        await backend.init();
        return backend;
    }

    async init(): Promise<this> {
        if (!this.canvas) throw new Error("[Awgpu.Backend] canvas is required");

        if (!navigator?.gpu) throw new Error("[Awgpu.Backend] WebGPU is not available");

        const adapter = await navigator.gpu.requestAdapter(this.options.pickBest ?? {});
        if (!adapter) throw new Error("[Awgpu.Backend] adapter request failed");

        const device  = await adapter.requestDevice(this.options.device ?? {});
        const format  = this.options.format ?? navigator.gpu.getPreferredCanvasFormat();
        const context = this.canvas.getContext("webgpu") as GPUCanvasContext | null;
        if (!context) throw new Error("[Awgpu.Backend] canvas webgpu context is required");

        context.configure({
            ...(this.options.context ?? {}),
            device,
            format,
            alphaMode: this.options.context?.alphaMode ?? "premultiplied",
        });

        this.adapter   = adapter;
        this.device    = device;
        this.queue     = device.queue;
        this.canvasCtx = context;
        this.format    = format;
        this.ready     = true;
        return this;
    }

    /** Gets the current view of the canvas context. */
    currentView(): GPUTextureView | null {
        if (!this.canvasCtx) return null;
        const currentTexture = this.canvasCtx.getCurrentTexture();
        return currentTexture ? currentTexture.createView() : null;
    }

    /** Creates a command encoder. */
    createEncoder(label = "AwgpuFrame"): GPUCommandEncoder | null {
        if (!this.device) return null;
        return this.device.createCommandEncoder({ label });
    }

    /** Submits an encoder or an array of command buffers to the GPU. */
    submit(encoderOrCommands: GPUCommandEncoder | GPUCommandBuffer[]): boolean {
        if (!this.queue || !encoderOrCommands) return false;
        const commands = Array.isArray(encoderOrCommands)
            ? encoderOrCommands
            : [encoderOrCommands.finish()];
        this.queue.submit(commands);
        return true;
    }

    /** Creates a fresh mutable context for recording a frame. */
    newCtx(): AwgpuCtx {
        return {
            device:    this.device,
            queue:     this.queue,
            canvas:    this.canvas,
            canvasCtx: this.canvasCtx,
            format:    this.format,

            encoder:   null,
            pass:      null,
            passKind:  null,
            pipeline:  null,

            buffers: {
                vertex:   new Map(),
                index:    null,
                indirect: null,
            },
            bindGroups: new Map(),
            textures:   new Map(),
            ended:      false,
        };
    }

    destroy(): void {
        if (this.canvasCtx) {
            try {
                (this.canvasCtx as GPUCanvasContext & { unconfigure?(): void }).unconfigure?.();
            } catch { /* ignore */ }
        }
        this.ready     = false;
        this.adapter   = null;
        this.device    = null;
        this.queue     = null;
        this.canvasCtx = null;
    }
}

export default Backend;
