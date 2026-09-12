import { Acmp } from "../../../Atoolkit/acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

/**
 * Binds a compiled WebGLProgram (equivalent of UsePipeline in WebGPU).
 */
export class UseProgram extends Acmp<Awgl2Ctx> {
    readonly program: WebGLProgram | null;

    constructor(program: WebGLProgram | null, _data: object = {}) {
        super();
        this.program = program ?? null;
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render" || !this.program) return;
        ctx.gl.useProgram(this.program);
        ctx.program = this.program;
    }
}
