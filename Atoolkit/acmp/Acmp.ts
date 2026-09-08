import type { Adiag } from "../adiag/index.js";

/**
 * Universal component primitive.
 *
 * Represents an atomic, isolated unit of execution.
 * Receives a mutable context (`ctx`) and an optional diagnostic
 * collector (`diag`), returning an optional typed result (`TRet`, defaults to `void`).
 */
export class Acmp<TCtx = unknown, TRet = void> {
    /**
     * Executes against the given context.
     * Record stuff with Adiag
     */
    exec(_ctx: TCtx, _diag?: Adiag): TRet {
        return undefined as unknown as TRet;
    }
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
 * Helper to construct an Acmp from a pure function.
 */
export function acmp<TCtx = unknown, TRet = void>(fn: AcmpFn<TCtx, TRet>): Acmp<TCtx, TRet> {
    return new AcmpFnWrapper(fn);
}
