import type { AwgpuDevice } from "./device.js";

/**
 * GPU texture wrapper containing hardware texture, view, and metadata.
 */
export class AwgpuTexture {
    readonly gpuTexture: GPUTexture;
    readonly gpuView: GPUTextureView;
    width: number;
    height: number;
    depthOrArrayLayers: number;
    readonly format: GPUTextureFormat;
    readonly sampleCount: number;
    readonly usage: GPUTextureUsageFlags;
    readonly gpuOwned: boolean;
    readonly label: string;

    constructor(
        gpuTexture: GPUTexture,
        gpuView: GPUTextureView,
        width: number,
        height: number,
        format: GPUTextureFormat,
        usage: GPUTextureUsageFlags,
        options: {
            depthOrArrayLayers?: number;
            sampleCount?: number;
            gpuOwned?: boolean;
            label?: string;
        } = {}
    ) {
        this.gpuTexture = gpuTexture;
        this.gpuView = gpuView;
        this.width = width;
        this.height = height;
        this.depthOrArrayLayers = options.depthOrArrayLayers ?? 1;
        this.format = format;
        this.sampleCount = options.sampleCount ?? 1;
        this.usage = usage;
        this.gpuOwned = options.gpuOwned ?? true;
        this.label = options.label ?? gpuTexture.label ?? "AwgpuTexture";
    }

    destroy(): void {
        if (this.gpuOwned) {
            this.gpuTexture.destroy();
        }
    }

    /**
     * Creates 2D color or data texture.
     */
    static create2D(
        device: GPUDevice,
        options: {
            width: number;
            height: number;
            format?: GPUTextureFormat;
            usage?: GPUTextureUsageFlags;
            sampleCount?: number;
            label?: string;
        }
    ): AwgpuTexture {
        const w = Math.max(1, options.width);
        const h = Math.max(1, options.height);
        const format = options.format ?? "rgba8unorm";
        const usage = options.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST);
        const label = options.label ?? "AwgpuTexture2D";

        const gpuTexture = device.createTexture({
            label,
            size: [w, h, 1],
            format,
            usage,
            sampleCount: options.sampleCount ?? 1,
        });
        const gpuView = gpuTexture.createView({ label: `${label}_View` });
        return new AwgpuTexture(gpuTexture, gpuView, w, h, format, usage, { label, sampleCount: options.sampleCount });
    }

    /**
     * Creates 2D depth or depth-stencil texture.
     */
    static createDepth(
        device: GPUDevice,
        options: {
            width: number;
            height: number;
            format?: GPUTextureFormat;
            usage?: GPUTextureUsageFlags;
            label?: string;
        }
    ): AwgpuTexture {
        const w = Math.max(1, options.width);
        const h = Math.max(1, options.height);
        const format = options.format ?? "depth24plus";
        const usage = options.usage ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING);
        const label = options.label ?? "AwgpuDepthTexture";

        const gpuTexture = device.createTexture({
            label,
            size: [w, h, 1],
            format,
            usage,
        });
        const gpuView = gpuTexture.createView({ label: `${label}_View` });
        return new AwgpuTexture(gpuTexture, gpuView, w, h, format, usage, { label });
    }

    /**
     * Wraps existing GPUTexture and GPUTextureView.
     */
    static fromTexture(
        gpuTexture: GPUTexture,
        options: {
            view?: GPUTextureView;
            label?: string;
            gpuOwned?: boolean;
        } = {}
    ): AwgpuTexture {
        const view = options.view ?? gpuTexture.createView();
        return new AwgpuTexture(
            gpuTexture,
            view,
            gpuTexture.width,
            gpuTexture.height,
            gpuTexture.format,
            gpuTexture.usage,
            {
                depthOrArrayLayers: gpuTexture.depthOrArrayLayers,
                sampleCount: gpuTexture.sampleCount,
                gpuOwned: options.gpuOwned ?? false,
                label: options.label ?? gpuTexture.label,
            }
        );
    }
}

/**
 * GPU sampler wrapper supporting filtering and depth comparison.
 */
export class AwgpuSampler {
    readonly gpuSampler: GPUSampler;
    readonly label: string;

    constructor(gpuSampler: GPUSampler, label = "AwgpuSampler") {
        this.gpuSampler = gpuSampler;
        this.label = label;
    }

    /**
     * Creates standard trilinear or bilinear filtering sampler.
     */
    static createLinear(device: GPUDevice, label = "AwgpuSamplerLinear"): AwgpuSampler {
        const gpuSampler = device.createSampler({
            label,
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
        });
        return new AwgpuSampler(gpuSampler, label);
    }

    /**
     * Creates point / nearest-neighbor sampler.
     */
    static createNearest(device: GPUDevice, label = "AwgpuSamplerNearest"): AwgpuSampler {
        const gpuSampler = device.createSampler({
            label,
            magFilter: "nearest",
            minFilter: "nearest",
            mipmapFilter: "nearest",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
        return new AwgpuSampler(gpuSampler, label);
    }

    /**
     * Creates hardware depth comparison sampler for shadow mapping.
     */
    static createComparison(
        device: GPUDevice,
        options: {
            compare?: GPUCompareFunction;
            label?: string;
        } = {}
    ): AwgpuSampler {
        const label = options.label ?? "AwgpuShadowSampler";
        const gpuSampler = device.createSampler({
            label,
            compare: options.compare ?? "less",
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge",
        });
        return new AwgpuSampler(gpuSampler, label);
    }
}

export interface AwgpuColorAttachmentConfig {
    texture: AwgpuTexture | null; // null indicates swapchain canvas texture view
    clearColor?: { r: number; g: number; b: number; a: number };
    loadOp?: GPULoadOp;
    storeOp?: GPUStoreOp;
    resolveTarget?: AwgpuTexture | null;
}

export interface AwgpuDepthAttachmentConfig {
    texture: AwgpuTexture;
    depthClearValue?: number;
    depthLoadOp?: GPULoadOp;
    depthStoreOp?: GPUStoreOp;
    stencilClearValue?: number;
    stencilLoadOp?: GPULoadOp;
    stencilStoreOp?: GPUStoreOp;
}

/**
 * Render destination descriptor supporting screen canvas, offscreen color buffers, MRT, and depth-only targets.
 */
export class AwgpuRenderTarget {
    readonly label: string;
    readonly isScreen: boolean;
    gfx?: AwgpuDevice;
    width: number;
    height: number;
    colorAttachments: AwgpuColorAttachmentConfig[] = [];
    depthAttachment?: AwgpuDepthAttachmentConfig;

    private depthFormat?: GPUTextureFormat;
    private colorFormat?: GPUTextureFormat;

    constructor(
        label: string,
        width: number,
        height: number,
        options: {
            isScreen?: boolean;
            gfx?: AwgpuDevice;
            colorAttachments?: AwgpuColorAttachmentConfig[];
            depthAttachment?: AwgpuDepthAttachmentConfig;
            depthFormat?: GPUTextureFormat;
            colorFormat?: GPUTextureFormat;
        } = {}
    ) {
        this.label = label;
        this.width = width;
        this.height = height;
        this.isScreen = options.isScreen ?? false;
        this.gfx = options.gfx;
        this.colorAttachments = options.colorAttachments ?? [];
        this.depthAttachment = options.depthAttachment;
        this.depthFormat = options.depthFormat;
        this.colorFormat = options.colorFormat;
    }

    /**
     * Factory: Creates render target bound to canvas swapchain backbuffer.
     */
    static createScreen(
        gfx: AwgpuDevice,
        options: {
            depthFormat?: GPUTextureFormat;
            clearColor?: { r: number; g: number; b: number; a: number };
            label?: string;
        } = {}
    ): AwgpuRenderTarget {
        const device = gfx.device;
        const canvas = gfx.canvas!;
        const w = Math.max(1, canvas.width);
        const h = Math.max(1, canvas.height);
        const depthFormat = options.depthFormat ?? "depth24plus";
        const clearColor = options.clearColor ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
        const label = options.label ?? "AwgpuScreenTarget";

        const depthTex = AwgpuTexture.createDepth(device, {
            width: w,
            height: h,
            format: depthFormat,
            label: `${label}_Depth`,
        });

        return new AwgpuRenderTarget(label, w, h, {
            isScreen: true,
            gfx,
            colorAttachments: [
                {
                    texture: null,
                    clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthAttachment: {
                texture: depthTex,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
            depthFormat,
            colorFormat: gfx.format ?? "bgra8unorm",
        });
    }

    /**
     * Factory: Creates offscreen color and depth render target (e.g. for HDR, G-buffer, or RTT).
     */
    static createOffscreen(
        device: GPUDevice,
        width: number,
        height: number,
        options: {
            colorFormat?: GPUTextureFormat;
            depthFormat?: GPUTextureFormat;
            clearColor?: { r: number; g: number; b: number; a: number };
            label?: string;
        } = {}
    ): AwgpuRenderTarget {
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        const colorFormat = options.colorFormat ?? "rgba8unorm";
        const depthFormat = options.depthFormat ?? "depth24plus";
        const clearColor = options.clearColor ?? { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
        const label = options.label ?? "AwgpuOffscreenTarget";

        const colorTex = AwgpuTexture.create2D(device, {
            width: w,
            height: h,
            format: colorFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
            label: `${label}_Color0`,
        });

        const depthTex = AwgpuTexture.createDepth(device, {
            width: w,
            height: h,
            format: depthFormat,
            label: `${label}_Depth`,
        });

        return new AwgpuRenderTarget(label, w, h, {
            isScreen: false,
            colorAttachments: [
                {
                    texture: colorTex,
                    clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
            depthAttachment: {
                texture: depthTex,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
            depthFormat,
            colorFormat,
        });
    }

    /**
     * Factory: Creates depth-only render target (e.g. for shadow maps or depth prepasses).
     */
    static createDepthOnly(
        device: GPUDevice,
        width: number,
        height: number,
        options: {
            depthFormat?: GPUTextureFormat;
            label?: string;
        } = {}
    ): AwgpuRenderTarget {
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        const depthFormat = options.depthFormat ?? "depth32float";
        const label = options.label ?? "AwgpuDepthOnlyTarget";

        const depthTex = AwgpuTexture.createDepth(device, {
            width: w,
            height: h,
            format: depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            label: `${label}_Depth`,
        });

        return new AwgpuRenderTarget(label, w, h, {
            isScreen: false,
            colorAttachments: [], // No color attachments in depth-only mode
            depthAttachment: {
                texture: depthTex,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
            depthFormat,
        });
    }

    /**
     * Resizes internal textures when target dimensions change.
     */
    resize(device: GPUDevice, width: number, height: number): void {
        const w = Math.max(1, width);
        const h = Math.max(1, height);
        if (this.width === w && this.height === h) return;

        this.width = w;
        this.height = h;

        // Reallocate depth texture
        if (this.depthAttachment && this.depthFormat) {
            this.depthAttachment.texture.destroy();
            this.depthAttachment.texture = AwgpuTexture.createDepth(device, {
                width: w,
                height: h,
                format: this.depthFormat,
                label: `${this.label}_Depth`,
            });
        }

        // Reallocate offscreen color textures
        if (!this.isScreen && this.colorFormat) {
            for (let i = 0; i < this.colorAttachments.length; i++) {
                const ca = this.colorAttachments[i];
                if (ca.texture) {
                    ca.texture.destroy();
                    ca.texture = AwgpuTexture.create2D(device, {
                        width: w,
                        height: h,
                        format: this.colorFormat,
                        label: `${this.label}_Color${i}`,
                    });
                }
            }
        }
    }

    /**
     * Builds GPURenderPassDescriptor for command recording in active frame.
     */
    buildPassDescriptor(): GPURenderPassDescriptor {
        const descriptor: GPURenderPassDescriptor = {
            label: `${this.label}_PassDescriptor`,
            colorAttachments: [],
        };

        if (this.isScreen) {
            const canvasView = this.gfx!.canvasContext!.getCurrentTexture().createView();
            const ca = this.colorAttachments[0];
            (descriptor.colorAttachments as GPURenderPassColorAttachment[]).push({
                view: canvasView,
                clearValue: ca?.clearColor ?? { r: 0, g: 0, b: 0, a: 1 },
                loadOp: ca?.loadOp ?? "clear",
                storeOp: ca?.storeOp ?? "store",
            });
        } else {
            for (const ca of this.colorAttachments) {
                if (ca.texture) {
                    const entry: GPURenderPassColorAttachment = {
                        view: ca.texture.gpuView,
                        clearValue: ca.clearColor ?? { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: ca.loadOp ?? "clear",
                        storeOp: ca.storeOp ?? "store",
                    };
                    if (ca.resolveTarget) {
                        entry.resolveTarget = ca.resolveTarget.gpuView;
                    }
                    (descriptor.colorAttachments as GPURenderPassColorAttachment[]).push(entry);
                }
            }
        }

        if (this.depthAttachment) {
            descriptor.depthStencilAttachment = {
                view: this.depthAttachment.texture.gpuView,
                depthClearValue: this.depthAttachment.depthClearValue ?? 1.0,
                depthLoadOp: this.depthAttachment.depthLoadOp ?? "clear",
                depthStoreOp: this.depthAttachment.depthStoreOp ?? "store",
            };
        }

        return descriptor;
    }

    destroy(): void {
        if (this.depthAttachment) {
            this.depthAttachment.texture.destroy();
        }
        for (const ca of this.colorAttachments) {
            if (ca.texture) {
                ca.texture.destroy();
            }
        }
    }
}
