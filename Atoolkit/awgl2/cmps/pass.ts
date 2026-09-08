import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

// ==================== Types =====================

export interface ScissorRect {
    x?:      number;
    y?:      number;
    width?:  number;
    height?: number;
}

export interface RenderPassData {
    framebuffer?:       WebGLFramebuffer | null;
    width?:             number;
    height?:            number;
    scissor?:           ScissorRect;
    clearColorEnabled?: boolean;
    clearColor?:        [number, number, number, number];
    useDepth?:          boolean;
    clearDepthEnabled?: boolean;
    clearDepth?:        number;
}

// ==================== Helpers =====================

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

// ==================== Components =====================

/**
 * Binds a framebuffer (null = default), sets the viewport, and clears
 * color/depth based on options.
 *
 * WebGL2 has no pass object: pass is just the currently bound framebuffer.
 * `passKind` is stored on ctx so downstream components can guard themselves.
 */
export class RenderPass extends Acmp<Awgl2Ctx> {
    readonly data: RenderPassData;

    constructor(data: RenderPassData = {}) {
        super();
        this.data = data;
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind) return;
        const gl = ctx.gl;

        const fbo = this.data.framebuffer ?? null;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        ctx.framebuffer = fbo;

        const canvas = ctx.backend.canvas;
        const w = Math.max(1, (this.data.width  ?? canvas?.width  ?? 1) | 0);
        const h = Math.max(1, (this.data.height ?? canvas?.height ?? 1) | 0);
        gl.viewport(0, 0, w, h);

        // Scissors
        if (this.data.scissor) {
            const s = this.data.scissor;
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(s.x ?? 0, s.y ?? 0, s.width ?? w, s.height ?? h);
        } else {
            gl.disable(gl.SCISSOR_TEST);
        }

        // Clear
        let clearMask = 0;

        if (this.data.clearColorEnabled !== false) {
            const c = this.data.clearColor ?? [0, 0, 0, 1];
            gl.clearColor(
                toNumber(c[0], 0),
                toNumber(c[1], 0),
                toNumber(c[2], 0),
                toNumber(c[3], 1),
            );
            gl.colorMask(true, true, true, true);
            clearMask |= gl.COLOR_BUFFER_BIT;
        }

        if (this.data.useDepth !== false && this.data.clearDepthEnabled !== false) {
            gl.clearDepth(toNumber(this.data.clearDepth, 1));
            gl.depthMask(true);
            clearMask |= gl.DEPTH_BUFFER_BIT;
        }

        if (clearMask) gl.clear(clearMask);

        ctx.passKind = "render";
        ctx.program  = null;
    }
}

/**
 * Unbinds the framebuffer and resets pass state.
 */
export class EndPass extends Acmp<Awgl2Ctx> {
    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || !ctx.passKind) return;
        ctx.gl.bindFramebuffer(ctx.gl.FRAMEBUFFER, null);
        ctx.framebuffer = null;
        ctx.passKind    = null;
        ctx.program     = null;
    }
}
