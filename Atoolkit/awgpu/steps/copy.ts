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

// ==================== Steps =====================

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
 * Copies data from a buffer into a texture.
 * Must be called outside of a pass.
 */
export class CopyBufferToTexture extends Acmp<AwgpuCtx> {
    readonly src:  GPUImageCopyBuffer | null;
    readonly dst:  GPUImageCopyTexture | null;
    readonly size: GPUExtent3D | null;

    constructor(data: Partial<CopyBufferToTextureData> = {}) {
        super();
        this.src  = data.src  ?? null;
        this.dst  = data.dst  ?? null;
        this.size = data.size ?? null;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        const encoder = ensureEncoder(ctx);
        if (!encoder) return;
        encoder.copyBufferToTexture(this.src, this.dst, this.size);
    }
}

/**
 * Copies data from a texture into a buffer.
 * Must be called outside of a pass.
 */
export class CopyTextureToBuffer extends Acmp<AwgpuCtx> {
    readonly src:  GPUImageCopyTexture | null;
    readonly dst:  GPUImageCopyBuffer  | null;
    readonly size: GPUExtent3D | null;

    constructor(data: Partial<CopyTextureToBufferData> = {}) {
        super();
        this.src  = data.src  ?? null;
        this.dst  = data.dst  ?? null;
        this.size = data.size ?? null;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        const encoder = ensureEncoder(ctx);
        if (!encoder) return;
        encoder.copyTextureToBuffer(this.src, this.dst, this.size);
    }
}

/**
 * Copies data from one texture to another.
 * Must be called outside of a pass.
 */
export class CopyTextureToTexture extends Acmp<AwgpuCtx> {
    readonly src:  GPUImageCopyTexture | null;
    readonly dst:  GPUImageCopyTexture | null;
    readonly size: GPUExtent3D | null;

    constructor(data: Partial<CopyTextureToTextureData> = {}) {
        super();
        this.src  = data.src  ?? null;
        this.dst  = data.dst  ?? null;
        this.size = data.size ?? null;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.pass || !this.src || !this.dst || !this.size) return;
        const encoder = ensureEncoder(ctx);
        if (!encoder) return;
        encoder.copyTextureToTexture(this.src, this.dst, this.size);
    }
}
