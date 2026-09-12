import { AwgpuRenderTarget } from "./target.js";

export interface AwgpuDeviceOptions {
    /** Target canvas element or selector string. If omitted, device initializes in headless mode. */
    canvas?: string | HTMLCanvasElement | null;
    /** Preferred texture format for canvas presentation; defaults to navigator.gpu.getPreferredCanvasFormat() */
    format?: GPUTextureFormat;
    /** Power preference for adapter selection; defaults to "high-performance" */
    powerPreference?: GPUPowerPreference;
    /** Optional required WebGPU features */
    requiredFeatures?: GPUFeatureName[];
    /** Optional required WebGPU limits */
    requiredLimits?: Record<string, GPUSize64>;
    /** Canvas presentation alpha mode; defaults to "premultiplied" */
    alphaMode?: GPUCanvasAlphaMode;
    /** Label for diagnostic and debugging identification */
    label?: string;
}

function resolveCanvas(canvasRef: string | HTMLCanvasElement | null | undefined): HTMLCanvasElement | null {
    if (!canvasRef) return null;
    if (typeof HTMLCanvasElement !== "undefined" && canvasRef instanceof HTMLCanvasElement) return canvasRef;
    if (typeof canvasRef === "string" && typeof document !== "undefined") {
        const found = document.querySelector(canvasRef);
        if (typeof HTMLCanvasElement !== "undefined" && found instanceof HTMLCanvasElement) return found;
    }
    return null;
}

/**
 * Hardware WebGPU device wrapper managing adapter negotiation, device lifetime,
 * command submission queue, and canvas presentation context.
 */
export class AwgpuDevice {
    readonly adapter: GPUAdapter;
    readonly device: GPUDevice;
    readonly queue: GPUQueue;
    readonly canvas: HTMLCanvasElement | null;
    readonly canvasContext: GPUCanvasContext | null;
    readonly format: GPUTextureFormat;
    readonly label: string;

    constructor(
        adapter: GPUAdapter,
        device: GPUDevice,
        format: GPUTextureFormat,
        options: {
            canvas?: HTMLCanvasElement | null;
            canvasContext?: GPUCanvasContext | null;
            label?: string;
        } = {}
    ) {
        this.adapter = adapter;
        this.device = device;
        this.queue = device.queue;
        this.format = format;
        this.canvas = options.canvas ?? null;
        this.canvasContext = options.canvasContext ?? null;
        this.label = options.label ?? "AwgpuDevice";
    }

    /**
     * Initializes WebGPU device connected to HTML canvas for graphics rendering.
     */
    static async create(options: AwgpuDeviceOptions = {}): Promise<AwgpuDevice> {
        if (typeof navigator === "undefined" || !navigator.gpu) {
            throw new Error("[AwgpuDevice] WebGPU is not supported or not available in this environment.");
        }

        const canvas = resolveCanvas(options.canvas);
        const powerPreference = options.powerPreference ?? "high-performance";

        const adapter = await navigator.gpu.requestAdapter({ powerPreference });
        if (!adapter) {
            throw new Error("[AwgpuDevice] Failed to acquire WebGPU GPUAdapter.");
        }

        const device = await adapter.requestDevice({
            label: options.label ?? "Awgpu_GPUDevice",
            requiredFeatures: options.requiredFeatures,
            requiredLimits: options.requiredLimits,
        });

        const format = options.format ?? (canvas ? navigator.gpu.getPreferredCanvasFormat() : "rgba8unorm");

        let canvasContext: GPUCanvasContext | null = null;
        if (canvas) {
            canvasContext = canvas.getContext("webgpu") as GPUCanvasContext | null;
            if (!canvasContext) {
                throw new Error("[AwgpuDevice] Failed to get WebGPU context from canvas element.");
            }
            canvasContext.configure({
                device,
                format,
                alphaMode: options.alphaMode ?? "premultiplied",
            });
        }

        return new AwgpuDevice(adapter, device, format, {
            canvas,
            canvasContext,
            label: options.label ?? "AwgpuDevice",
        });
    }

    /**
     * Initializes headless WebGPU device without canvas (for compute passes, tests, or offscreen workers).
     */
    static async createHeadless(options: Omit<AwgpuDeviceOptions, "canvas"> = {}): Promise<AwgpuDevice> {
        return AwgpuDevice.create({ ...options, canvas: null });
    }

    /**
     * Creates screen render target bound to device canvas swapchain.
     */
    createScreenTarget(
        options: {
            depthFormat?: GPUTextureFormat;
            clearColor?: { r: number; g: number; b: number; a: number };
            label?: string;
        } = {}
    ): AwgpuRenderTarget {
        if (!this.canvas || !this.canvasContext) {
            throw new Error("[AwgpuDevice.createScreenTarget] Cannot create screen target on headless device.");
        }
        return AwgpuRenderTarget.createScreen(this, options);
    }

    /**
     * Creates fresh GPUCommandEncoder on device.
     */
    createCommandEncoder(label = "AwgpuCommandEncoder"): GPUCommandEncoder {
        return this.device.createCommandEncoder({ label });
    }

    /**
     * Submits command buffers or command encoders to device queue.
     */
    submit(commands: (GPUCommandBuffer | GPUCommandEncoder)[] | GPUCommandBuffer | GPUCommandEncoder): void {
        const list = Array.isArray(commands) ? commands : [commands];
        const buffers: GPUCommandBuffer[] = list.map((c) => {
            if ("finish" in c && typeof c.finish === "function") {
                return (c as GPUCommandEncoder).finish();
            }
            return c as GPUCommandBuffer;
        });
        this.queue.submit(buffers);
    }

    /**
     * Destroys device resources and unconfigures canvas context.
     */
    destroy(): void {
        if (this.canvasContext) {
            try {
                (this.canvasContext as GPUCanvasContext & { unconfigure?(): void }).unconfigure?.();
            } catch {
                // Ignore if unconfigure is unsupported in current browser
            }
        }
        this.device.destroy();
    }
}
