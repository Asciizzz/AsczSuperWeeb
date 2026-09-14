import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { AwgpuCtx } from "../ctx.js";

export interface BindGroupEntry {
    index?:     number;
    bindGroup?: GPUBindGroup;
    offsets?:   Iterable<number>;
}

/**
 * Sets one or more bind groups on the active pass.
 */
export class SetBindGroups extends Acmp<AwgpuCtx> {
    readonly groups: BindGroupEntry[];

    constructor(groups: BindGroupEntry[] = []) {
        super();
        this.groups = Array.isArray(groups) ? groups.slice() : [];
    }

    override exec(ctx: AwgpuCtx, _diag?: Adiag): void {
        if (!ctx.pass) return;

        const pass = ctx.pass as GPURenderPassEncoder | GPUComputePassEncoder;

        for (const entry of this.groups) {
            const index     = Math.max(0, Number(entry?.index ?? 0) | 0);
            const bindGroup = entry?.bindGroup ?? null;
            if (!bindGroup) continue;
            const offsets = entry?.offsets;
            if (offsets) pass.setBindGroup(index, bindGroup, offsets);
            else         pass.setBindGroup(index, bindGroup);
            ctx.bindGroups.set(index, { bindGroup, offsets: offsets ?? null });
        }
    }
}
