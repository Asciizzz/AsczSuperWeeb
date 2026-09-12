import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

// ==================== Types =====================

export interface CopyBufferToBufferData {
    src:        GPUBuffer;
    dst:        GPUBuffer;
    srcOffset?: number;
    dstOffset?: number;
    size:       number;
}

export interface CopyBufferToTextureData {
    src:  GPUImageCopyBuffer;
    dst:  GPUImageCopyTexture;
    size: GPUExtent3D;
}

export interface CopyTextureToBufferData {
    src:  GPUImageCopyTexture;
    dst:  GPUImageCopyBuffer;
    size: GPUExtent3D;
}

export interface CopyTextureToTextureData {
    src:  GPUImageCopyTexture;
    dst:  GPUImageCopyTexture;
    size: GPUExtent3D;
}

// ==================== Helpers =====================

function uint(value: unknown, fallback = 0): number {
    return Math.max(0, Number(value ?? fallback) | 0);
}

function ensureEncoder(ctx: AwgpuCtx, label = "AwgpuCopy"): GPUCommandEncoder | null {
    if (ctx.encoder) return ctx.encoder;
    if (!ctx.device) return null;
    ctx.encoder = ctx.device.createCommandEncoder({ label });
    ctx.ended = false;
    return ctx.encoder;
}

// ==================== Components =====================

/**
 * Copies bytes from one GPUBuffer to another.
 * Must be called outside of a pass (between EndPass and EndFrame).
 */
export class CopyBufferToBuffer extends Acmp<AwgpuCtx> {
    readonly src:       GPUBuffer | null;
    readonly dst:       GPUBuffer | null;
    readonly srcOffset: number;
    readonly dstOffset: number;
    readonly size:      number;

    constructor(data: Partial<CopyBufferToBufferData> = {}) {
        super();
        this.src       = data.src ?? null;
        this.dst       = data.dst ?? null;
        this.srcOffset = uint(data.srcOffset);
        this.dstOffset = uint(data.dstOffset);
        this.size      = uint(data.size);
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || this.size <= 0) return;
        const encoder = ensureEncoder(ctx);
        if (!encoder) return;
        encoder.copyBufferToBuffer(this.src, this.srcOffset, this.dst, this.dstOffset, this.size);
    }
}

/**
 * Base class for texture copy operations sharing source, destination, and extent properties.
 */
export abstract class CopyImageBase<TSrc, TDst> extends Acmp<AwgpuCtx> {
    readonly src:  TSrc | null;
    readonly dst:  TDst | null;
    readonly size: GPUExtent3D | null;

    constructor(data: { src?: TSrc; dst?: TDst; size?: GPUExtent3D } = {}) {
        super();
        this.src  = data.src  ?? null;
        this.dst  = data.dst  ?? null;
        this.size = data.size ?? null;
    }
}

/**
 * Copies data from a buffer into a texture.
 * Must be called outside of a pass.
 */
export class CopyBufferToTexture extends CopyImageBase<GPUImageCopyBuffer, GPUImageCopyTexture> {
    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        ensureEncoder(ctx)?.copyBufferToTexture(this.src, this.dst, this.size);
    }
}

/**
 * Copies data from a texture into a buffer.
 * Must be called outside of a pass.
 */
export class CopyTextureToBuffer extends CopyImageBase<GPUImageCopyTexture, GPUImageCopyBuffer> {
    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        ensureEncoder(ctx)?.copyTextureToBuffer(this.src, this.dst, this.size);
    }
}

/**
 * Copies data from one texture to another.
 * Must be called outside of a pass.
 */
export class CopyTextureToTexture extends CopyImageBase<GPUImageCopyTexture, GPUImageCopyTexture> {
    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        ensureEncoder(ctx)?.copyTextureToTexture(this.src, this.dst, this.size);
    }
}
