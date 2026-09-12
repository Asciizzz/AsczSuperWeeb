import { Acmp } from "../../../Atoolkit/acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

// ==================== Types =====================

export interface DrawData {
    /** gl.TRIANGLES / gl.LINES / gl.POINTS etc. (null defaults to gl.TRIANGLES) */
    mode?:          number | null;
    first?:         number;
    firstVertex?:   number;
    count?:         number;
    vertexCount?:   number;
    instanceCount?: number;
}

export interface DrawIndexedData {
    mode?:          number | null;
    count?:         number;
    indexCount?:    number;
    /** gl.UNSIGNED_SHORT | gl.UNSIGNED_INT (null defaults to ctx.buffers.index) */
    type?:          number | null;
    offset?:        number;
    instanceCount?: number;
}

// ==================== Helpers =====================

function uint(value: unknown, fallback = 0): number {
    return Math.max(0, Number(value ?? fallback) | 0);
}

// ==================== Components =====================

/**
 * Non-indexed vertex drawing via gl.drawArrays / gl.drawArraysInstanced.
 */
export class Draw extends Acmp<Awgl2Ctx> {
    readonly mode:          number | null;
    readonly first:         number;
    readonly count:         number;
    readonly instanceCount: number;

    constructor(data: DrawData = {}) {
        super();
        this.mode          = data.mode ?? null;
        this.first         = uint(data.first ?? data.firstVertex);
        this.count         = uint(data.count ?? data.vertexCount);
        this.instanceCount = uint(data.instanceCount);
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render" || !ctx.program) return;
        const gl   = ctx.gl;
        const mode = this.mode ?? gl.TRIANGLES;
        if (this.instanceCount > 0) {
            gl.drawArraysInstanced(mode, this.first, this.count, this.instanceCount);
        } else {
            gl.drawArrays(mode, this.first, this.count);
        }
    }
}

/**
 * Indexed drawing via gl.drawElements / gl.drawElementsInstanced.
 */
export class DrawIndexed extends Acmp<Awgl2Ctx> {
    readonly mode:          number | null;
    readonly count:         number;
    readonly type:          number | null;
    readonly offset:        number;
    readonly instanceCount: number;

    constructor(data: DrawIndexedData = {}) {
        super();
        this.mode          = data.mode ?? null;
        this.count         = uint(data.count ?? data.indexCount);
        this.type          = data.type ?? null;
        this.offset        = uint(data.offset);
        this.instanceCount = uint(data.instanceCount);
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render" || !ctx.program) return;
        const gl   = ctx.gl;
        const mode = this.mode ?? gl.TRIANGLES;
        const type = this.type ?? ctx.buffers.index?.type ?? gl.UNSIGNED_SHORT;
        if (this.instanceCount > 0) {
            gl.drawElementsInstanced(mode, this.count, type, this.offset, this.instanceCount);
        } else {
            gl.drawElements(mode, this.count, type, this.offset);
        }
    }
}
