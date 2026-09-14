import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

/**
 * Resets all per-frame mutable state on the ctx.
 * WebGL2 has no encoder object; resetting context state marks the frame start.
 */
export class BeginFrame extends Acmp<Awgl2Ctx> {
    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        ctx.ended       = false;
        ctx.program     = null;
        ctx.vao         = null;
        ctx.framebuffer = null;
        ctx.buffers.vertex.clear();
        ctx.buffers.index = null;
        ctx.textures.clear();
    }
}

/**
 * Flushes pending GPU commands and marks the frame as ended.
 */
export class EndFrame extends Acmp<Awgl2Ctx> {
    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.ended) return;
        ctx.gl.flush();
        ctx.ended = true;
    }
}
