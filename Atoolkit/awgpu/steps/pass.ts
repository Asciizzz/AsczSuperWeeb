import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

// ==================== Types =====================

export interface RenderPassData {
    label?: string;
    colorAttachments?: (GPURenderPassColorAttachment | null)[] | ((ctx: AwgpuCtx) => (GPURenderPassColorAttachment | null)[]);
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment | undefined | ((ctx: AwgpuCtx) => GPURenderPassDepthStencilAttachment | undefined);
}

export interface ComputePassData {
    label?: string;
    timestampWrites?: GPUComputePassTimestampWrites;
}

// ==================== Steps =====================

/**
 * Begins a render pass for drawing operations.
 *
 * `colorAttachments` and `depthStencilAttachment` can be provided as
 * functions to obtain a fresh GPUTextureView each frame.
 */
export class RenderPass extends Acmp<AwgpuCtx> {
    readonly data: RenderPassData;

    constructor(data: RenderPassData = {}) {
        super();
        this.data = data;
    }

    override exec(ctx: AwgpuCtx, diag?: Adiag): void {
        if (!ctx.device) {
            if (diag) diag.err({ code: "DEVICE_LOST", raw: "Cannot begin render pass: Device is lost.", data: {} });
            return;
        }

        if (!ctx.encoder) {
            ctx.encoder = ctx.device.createCommandEncoder({ label: "AwgpuRenderFrame" });
        }
        // If a pass is already active, bail: EndPass should have been called first
        if (ctx.pass) return;

        const colorAttachments = typeof this.data.colorAttachments === "function"
            ? this.data.colorAttachments(ctx)
            : this.data.colorAttachments;
            
        const depthStencilAttachment = typeof this.data.depthStencilAttachment === "function"
            ? this.data.depthStencilAttachment(ctx)
            : this.data.depthStencilAttachment;

        // Need at least one attachment
        let hasColor = false;
        if (colorAttachments) {
            for (const a of colorAttachments) {
                if (a != null) { hasColor = true; break; }
            }
        }
        if (!hasColor && !depthStencilAttachment) return;

        ctx.pass = ctx.encoder.beginRenderPass({
            label: this.data.label,
            colorAttachments: (colorAttachments as (GPURenderPassColorAttachment | null)[]) ?? [],
            depthStencilAttachment,
        });
        ctx.passKind = "render";
        ctx.pipeline = null;
    }
}

/**
 * Begins a compute pass for compute shader operations.
 */
export class ComputePass extends Acmp<AwgpuCtx> {
    readonly data: ComputePassData;

    constructor(data: ComputePassData = {}) {
        super();
        this.data = data;
    }

    override exec(ctx: AwgpuCtx, diag?: Adiag): void {
        if (!ctx.device) {
            if (diag) diag.err({ code: "DEVICE_LOST", raw: "Cannot begin compute pass: Device is lost.", data: {} });
            return;
        }

        if (!ctx.encoder) {
            ctx.encoder = ctx.device.createCommandEncoder({ label: "AwgpuComputeFrame" });
        }
        if (ctx.pass) return;
        ctx.pass = ctx.encoder.beginComputePass({
            label: this.data.label,
            timestampWrites: this.data.timestampWrites,
        });
        ctx.passKind = "compute";
        ctx.pipeline = null;
    }
}

/**
 * Ends the current render or compute pass.
 */
export class EndPass extends Acmp<AwgpuCtx> {
    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass) return;
        ctx.pass.end();
        ctx.pass     = null;
        ctx.passKind = null;
        ctx.pipeline = null;
    }
}
