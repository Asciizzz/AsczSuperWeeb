import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

// ==================== Types =====================

export interface TextureEntry {
    unit?:     number;
    texture:   WebGLTexture;
    /** Default: gl.TEXTURE_2D */
    target?:   number;
    /** Sampler uniform name (if provided, unit index is written automatically) */
    uniform?:  string;
    /** Override which program to look the location up on (default: ctx.program) */
    program?:  WebGLProgram;
}

// ==================== Components =====================

/**
 * Activates texture units, binds WebGLTextures, and optionally wires
 * sampler uniforms so callers don't have to do it separately.
 *
 * Equivalent of SetBindGroups on the texture side.
 */
export class SetTextures extends Acmp<Awgl2Ctx> {
    readonly entries: TextureEntry[];

    constructor(entries: TextureEntry[] = [], _data: object = {}) {
        super();
        this.entries = Array.isArray(entries) ? entries.slice() : [];
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render") return;
        const gl = ctx.gl;

        for (const entry of this.entries) {
            const texture = entry?.texture ?? null;
            if (!texture) continue;

            const unit   = Math.max(0, Number(entry.unit ?? 0) | 0);
            const target = entry.target ?? gl.TEXTURE_2D;

            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(target, texture);
            ctx.textures.set(unit, { texture, target });

            // Optionally wire the sampler uniform
            if (entry.uniform && ctx.program) {
                const prog = entry.program ?? ctx.program;
                const loc  = gl.getUniformLocation(prog, entry.uniform);
                if (loc != null) gl.uniform1i(loc, unit);
            }
        }
    }
}
