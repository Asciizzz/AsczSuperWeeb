import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

// ==================== Types =====================

export type UniformType =
    | "1i" | "1f"
    | "2f" | "3f" | "4f"
    | "1iv" | "1fv" | "2fv" | "3fv" | "4fv"
    | "mat2" | "mat3" | "mat4";

export interface UniformEntryBase {
    name:       string;
    /** Override which program to look the location up on (default: ctx.program) */
    program?:   WebGLProgram;
}

export type UniformEntry = UniformEntryBase & (
    | { type: "1i" | "1f"; value: number }
    | { type: "2f" | "3f" | "4f"; value: [number, number, ...number[]] | Float32Array }
    | { type: "1iv"; value: number[] | Int32Array }
    | { type: "1fv" | "2fv" | "3fv" | "4fv"; value: number[] | Float32Array }
    | { type: "mat2" | "mat3" | "mat4"; value: number[] | Float32Array; transpose?: boolean }
);

// ==================== Components =====================

/**
 * Uploads uniform values (scalars, vectors, matrices) to the active program.
 *
 * Equivalent of SetBindGroups on the non-texture uniform side.
 */
export class SetUniforms extends Acmp<Awgl2Ctx> {
    readonly entries: UniformEntry[];

    constructor(entries: UniformEntry[] = [], _data: object = {}) {
        super();
        this.entries = Array.isArray(entries) ? entries.slice() : [];
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render") return;
        const gl = ctx.gl;

        for (const entry of this.entries) {
            const prog = entry.program ?? ctx.program;
            if (!prog || !entry.name) continue;

            const loc = gl.getUniformLocation(prog, entry.name);
            if (loc == null) continue;

            switch (entry.type) {
                case "1i":   gl.uniform1i(loc, entry.value);                    break;
                case "1f":   gl.uniform1f(loc, entry.value);                    break;
                case "2f":   gl.uniform2f(loc, entry.value[0], entry.value[1]); break;
                case "3f":   gl.uniform3f(loc, entry.value[0], entry.value[1], entry.value[2]); break;
                case "4f":   gl.uniform4f(loc, entry.value[0], entry.value[1], entry.value[2], entry.value[3]); break;
                case "1iv":  gl.uniform1iv(loc, entry.value);                   break;
                case "1fv":  gl.uniform1fv(loc, entry.value);                   break;
                case "2fv":  gl.uniform2fv(loc, entry.value);                   break;
                case "3fv":  gl.uniform3fv(loc, entry.value);                   break;
                case "4fv":  gl.uniform4fv(loc, entry.value);                   break;
                case "mat2": gl.uniformMatrix2fv(loc, entry.transpose ?? false, entry.value);         break;
                case "mat3": gl.uniformMatrix3fv(loc, entry.transpose ?? false, entry.value);         break;
                case "mat4": gl.uniformMatrix4fv(loc, entry.transpose ?? false, entry.value);         break;
                default:     break;
            }
        }
    }
}
