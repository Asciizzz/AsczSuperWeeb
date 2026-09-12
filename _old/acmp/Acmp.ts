import type { Adiag } from "../../Atoolkit/adiag/index.js";

/**
 * Universal component primitive.
 */
export abstract class Acmp<TCtx = unknown, TRet = void> {
    /**
     * Executes against the given context.
     * Records diagnostics on failure via diag.
     */
    abstract exec(ctx: TCtx, diag?: Adiag): TRet;
}

/**
 * Functional component handler.
 */
export type AcmpFn<TCtx = unknown, TRet = void> = (ctx: TCtx, diag?: Adiag) => TRet;

/**
 * Wraps a standalone function as an Acmp instance.
 */
export class AcmpFnWrapper<TCtx = unknown, TRet = void> extends Acmp<TCtx, TRet> {
    readonly fn: AcmpFn<TCtx, TRet>;

    constructor(fn: AcmpFn<TCtx, TRet>) {
        super();
        this.fn = fn;
    }

    override exec(ctx: TCtx, diag?: Adiag): TRet {
        return this.fn(ctx, diag);
    }
}

/**
 * Constructs an Acmp from a function.
 */
export function acmp<TCtx = unknown, TRet = void>(fn: AcmpFn<TCtx, TRet>): Acmp<TCtx, TRet> {
    return new AcmpFnWrapper(fn);
}
