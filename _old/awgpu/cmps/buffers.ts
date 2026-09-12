import { Acmp } from "../../../Atoolkit/acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

// ==================== Types =====================

export interface VertexBufferEntry {
    slot?:   number;
    buffer:  GPUBuffer;
    offset?: number;
    size?:   number;
}

export interface IndexBufferEntry {
    buffer:  GPUBuffer;
    format?: GPUIndexFormat;
    offset?: number;
    size?:   number;
}

export interface IndirectBufferEntry {
    buffer:  GPUBuffer;
    offset?: number;
}

// ==================== Helpers =====================

function toList<T>(value: T | T[] | undefined | null): T[] {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

function uint(value: number | string | null | undefined, fallback = 0): number {
    return Math.max(0, Number(value ?? fallback) | 0);
}

export interface SetBuffersData {
    vertex?:   VertexBufferEntry | VertexBufferEntry[] | ((ctx: AwgpuCtx) => VertexBufferEntry | VertexBufferEntry[]);
    index?:    IndexBufferEntry | ((ctx: AwgpuCtx) => IndexBufferEntry);
    indirect?: IndirectBufferEntry | ((ctx: AwgpuCtx) => IndirectBufferEntry);
}

// ==================== Components =====================

/**
 * Sets vertex, index, and indirect buffers on the active pass.
 */
export class SetBuffers extends Acmp<AwgpuCtx> {
    readonly data: SetBuffersData;

    constructor(data: SetBuffersData = {}) {
        super();
        this.data = data;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "render") return;
        const pass = ctx.pass as GPURenderPassEncoder;

        const vData = typeof this.data.vertex === "function" ? this.data.vertex(ctx) : this.data.vertex;
        const vertex = toList(vData);
        const index = typeof this.data.index === "function" ? this.data.index(ctx) : this.data.index;
        const indirect = typeof this.data.indirect === "function" ? this.data.indirect(ctx) : this.data.indirect;

        this.#setVertexBuffers(ctx, pass, vertex);
        this.#setIndexBuffer(ctx, pass, index ?? null);
        this.#setIndirectBuffer(ctx, indirect ?? null);
    }

    #setVertexBuffers(ctx: AwgpuCtx, pass: GPURenderPassEncoder, vertex: VertexBufferEntry[]): void {
        for (const entry of vertex) {
            const slot   = uint(entry?.slot);
            const buffer = entry?.buffer ?? null;
            if (!buffer) continue;
            const offset = uint(entry.offset);
            if (entry.size == null) pass.setVertexBuffer(slot, buffer, offset);
            else                    pass.setVertexBuffer(slot, buffer, offset, uint(entry.size));
            ctx.buffers.vertex.set(slot, { buffer, offset, size: entry.size ?? null });
        }
    }

    #setIndexBuffer(ctx: AwgpuCtx, pass: GPURenderPassEncoder, index: IndexBufferEntry | null): void {
        if (!index?.buffer) return;
        const offset = uint(index.offset);
        const format = index.format ?? "uint32";
        if (index.size == null) pass.setIndexBuffer(index.buffer, format, offset);
        else                         pass.setIndexBuffer(index.buffer, format, offset, uint(index.size));
        ctx.buffers.index = { buffer: index.buffer, format, offset, size: index.size ?? null };
    }

    #setIndirectBuffer(ctx: AwgpuCtx, indirect: IndirectBufferEntry | null): void {
        if (!indirect?.buffer) return;
        ctx.buffers.indirect = { buffer: indirect.buffer, offset: uint(indirect.offset) };
    }
}
