import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

// ==================== Types =====================

export interface DispatchData {
    x?: number;
    y?: number;
    z?: number;
}

export interface DispatchIndirectData {
    buffer:  GPUBuffer;
    offset?: number;
}

// ==================== Helpers =====================

function uint(value: unknown, fallback = 1): number {
    return Math.max(1, Number(value ?? fallback) | 0);
}

// ==================== Components =====================

/**
 * Dispatches compute workgroups.
 */
export class Dispatch extends Acmp<AwgpuCtx> {
    readonly x: number;
    readonly y: number;
    readonly z: number;

    constructor(data: DispatchData = {}) {
        super();
        this.x = uint(data.x);
        this.y = uint(data.y);
        this.z = uint(data.z);
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "compute" || !ctx.pipeline) return;
        (ctx.pass as GPUComputePassEncoder).dispatchWorkgroups(this.x, this.y, this.z);
    }
}

/**
 * Dispatches compute workgroups with parameters from an indirect buffer.
 */
export class DispatchIndirect extends Acmp<AwgpuCtx> {
    readonly buffer: GPUBuffer | null;
    readonly offset: number;

    constructor(data: Partial<DispatchIndirectData> = {}) {
        super();
        this.buffer = data.buffer ?? null;
        this.offset = Math.max(0, Number(data.offset ?? 0) | 0);
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || ctx.passKind !== "compute" || !ctx.pipeline || !this.buffer) return;
        (ctx.pass as GPUComputePassEncoder).dispatchWorkgroupsIndirect(this.buffer, this.offset);
    }
}
