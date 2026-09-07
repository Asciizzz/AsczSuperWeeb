import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

// ==================== Types =====================

function uint(value: number | undefined, fallback = 0): number {
    return Math.max(0, Number(value ?? fallback) | 0);
}

function ucount(value: number | undefined, fallback = 1): number {
    return Math.max(1, Number(value ?? fallback) | 0);
}

export interface DrawData {
    vertexCount?:   number | ((ctx: AwgpuCtx) => number);
    instanceCount?: number | ((ctx: AwgpuCtx) => number);
    firstVertex?:   number | ((ctx: AwgpuCtx) => number);
    firstInstance?: number | ((ctx: AwgpuCtx) => number);
}

export interface DrawIndexedData {
    indexCount?:    number | ((ctx: AwgpuCtx) => number);
    instanceCount?: number | ((ctx: AwgpuCtx) => number);
    firstIndex?:    number | ((ctx: AwgpuCtx) => number);
    baseVertex?:    number | ((ctx: AwgpuCtx) => number);
    firstInstance?: number | ((ctx: AwgpuCtx) => number);
}

export interface DrawIndirectData {
    buffer?: GPUBuffer | ((ctx: AwgpuCtx) => GPUBuffer);
    offset?: number | ((ctx: AwgpuCtx) => number);
}

// ==================== Steps =====================

/**
 * Issues a draw call without an index buffer.
 */
export class Draw extends Acmp<AwgpuCtx> {
    readonly data: DrawData;

    constructor(data: DrawData = {}) {
        super();
        this.data = data;
    }

    vertexCount(ctx: AwgpuCtx): number { return uint(typeof this.data.vertexCount === "function" ? this.data.vertexCount(ctx) : this.data.vertexCount, 0); }
    instanceCount(ctx: AwgpuCtx): number { return ucount(typeof this.data.instanceCount === "function" ? this.data.instanceCount(ctx) : this.data.instanceCount, 1); }
    firstVertex(ctx: AwgpuCtx): number { return uint(typeof this.data.firstVertex === "function" ? this.data.firstVertex(ctx) : this.data.firstVertex, 0); }
    firstInstance(ctx: AwgpuCtx): number { return uint(typeof this.data.firstInstance === "function" ? this.data.firstInstance(ctx) : this.data.firstInstance, 0); }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render" || !ctx.pipeline) return;
        (ctx.pass as GPURenderPassEncoder).draw(
            this.vertexCount(ctx), this.instanceCount(ctx), this.firstVertex(ctx), this.firstInstance(ctx)
        );
    }
}

/**
 * Issues an indexed draw call using an index buffer.
 */
export class DrawIndexed extends Acmp<AwgpuCtx> {
    readonly data: DrawIndexedData;

    constructor(data: DrawIndexedData = {}) {
        super();
        this.data = data;
    }

    indexCount(ctx: AwgpuCtx): number { return uint(typeof this.data.indexCount === "function" ? this.data.indexCount(ctx) : this.data.indexCount, 0); }
    instanceCount(ctx: AwgpuCtx): number { return ucount(typeof this.data.instanceCount === "function" ? this.data.instanceCount(ctx) : this.data.instanceCount, 1); }
    firstIndex(ctx: AwgpuCtx): number { return uint(typeof this.data.firstIndex === "function" ? this.data.firstIndex(ctx) : this.data.firstIndex, 0); }
    baseVertex(ctx: AwgpuCtx): number { return uint(typeof this.data.baseVertex === "function" ? this.data.baseVertex(ctx) : this.data.baseVertex, 0); }
    firstInstance(ctx: AwgpuCtx): number { return uint(typeof this.data.firstInstance === "function" ? this.data.firstInstance(ctx) : this.data.firstInstance, 0); }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render" || !ctx.pipeline) return;
        (ctx.pass as GPURenderPassEncoder).drawIndexed(
            this.indexCount(ctx), this.instanceCount(ctx), this.firstIndex(ctx), this.baseVertex(ctx), this.firstInstance(ctx)
        );
    }
}

/**
 * Issues a draw call with parameters from an indirect buffer.
 * Falls back to `ctx.buffers.indirect` if no buffer is provided.
 */
export class DrawIndirect extends Acmp<AwgpuCtx> {
    readonly data: DrawIndirectData;

    constructor(data: DrawIndirectData = {}) {
        super();
        this.data = data;
    }

    buffer(ctx: AwgpuCtx): GPUBuffer | null {
        return (typeof this.data.buffer === "function" ? this.data.buffer(ctx) : this.data.buffer) ?? null;
    }

    offset(ctx: AwgpuCtx): number {
        return uint(typeof this.data.offset === "function" ? this.data.offset(ctx) : this.data.offset, 0);
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render" || !ctx.pipeline) return;
        const buf = this.buffer(ctx);
        const indirect = buf
            ? { buffer: buf, offset: this.offset(ctx) }
            : ctx.buffers.indirect;
        if (!indirect?.buffer) return;
        (ctx.pass as GPURenderPassEncoder).drawIndirect(indirect.buffer, indirect.offset ?? 0);
    }
}

/**
 * Issues an indexed draw call with parameters from an indirect buffer.
 * Falls back to `ctx.buffers.indirect` if no buffer is provided.
 */
export class DrawIndexedIndirect extends Acmp<AwgpuCtx> {
    readonly data: DrawIndirectData;

    constructor(data: DrawIndirectData = {}) {
        super();
        this.data = data;
    }

    buffer(ctx: AwgpuCtx): GPUBuffer | null {
        return (typeof this.data.buffer === "function" ? this.data.buffer(ctx) : this.data.buffer) ?? null;
    }

    offset(ctx: AwgpuCtx): number {
        return uint(typeof this.data.offset === "function" ? this.data.offset(ctx) : this.data.offset, 0);
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render" || !ctx.pipeline) return;
        const buf = this.buffer(ctx);
        const indirect = buf
            ? { buffer: buf, offset: this.offset(ctx) }
            : ctx.buffers.indirect;
        if (!indirect?.buffer) return;
        (ctx.pass as GPURenderPassEncoder).drawIndexedIndirect(indirect.buffer, indirect.offset ?? 0);
    }
}
