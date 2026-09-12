import { Acmp } from "../../../Atoolkit/acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

/**
 * Binds a render or compute pipeline to the current pass.
 */
export class UsePipeline extends Acmp<AwgpuCtx> {
    readonly pipeline: GPURenderPipeline | GPUComputePipeline | null;

    constructor(pipeline: GPURenderPipeline | GPUComputePipeline | null) {
        super();
        this.pipeline = pipeline ?? null;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass || !this.pipeline) return;

        if (ctx.passKind === "render") {
            (ctx.pass as GPURenderPassEncoder).setPipeline(this.pipeline as GPURenderPipeline);
        } else if (ctx.passKind === "compute") {
            (ctx.pass as GPUComputePassEncoder).setPipeline(this.pipeline as GPUComputePipeline);
        }

        ctx.pipeline = this.pipeline;
    }
}
