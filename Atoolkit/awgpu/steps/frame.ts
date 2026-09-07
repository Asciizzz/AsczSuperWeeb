import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

/**
 * Creates and begins a new command encoder for the current frame.
 * Call at the start of each render frame to initialize command recording.
 */
export class BeginFrame extends Acmp<AwgpuCtx> {
    readonly label: string;

    constructor(label = "AwgpuFrame") {
        super();
        this.label = label;
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.encoder) return;
        ctx.encoder = ctx.device!.createCommandEncoder({ label: this.label });
        ctx.ended = false;
    }
}

/**
 * Submits the accumulated command encoder to the GPU and ends the frame.
 * Call at the end of each render frame after all passes are recorded.
 */
export class EndFrame extends Acmp<AwgpuCtx> {
    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (ctx.encoder && !ctx.ended) {
            ctx.queue!.submit([ctx.encoder.finish()]);
            ctx.ended = true;
        }
    }
}
