# Aflow

Graph execution engine built around `Acmp` and `Agraph`. Orchestrates arrays of components (`Acmp[]`) across graph nodes using depth-first search.

---

## Execution Model

1. **Graph Orchestration**: Wraps an `Agraph` instance to separate graph topology from component execution.
2. **Context & Diagnostics**: Passes a shared mutable `ctx` and optional diagnostic collector `diag` directly via `cmp.exec(ctx, diag)`.
3. **Deterministic Edge Ordering**: Executes outgoing links in array order. Use `sortOutgoingLinks` to control branch priority explicitly.
4. **Execution Modes**: Supports multi-pass branch reuse (`visitMode: "path"`) and single-pass task graphs (`visitMode: "once"`).
5. **Causal Error Chaining**: Halts on component error and chains the node-level diagnostic record to the component failure via `ref`.

---

## Quick Start

```ts
import { Adiag } from "../adiag/index.js";
import { Agraph } from "../agraph/index.js";
import { Aflow } from "../aflow/index.js";
import { Acmp } from "../acmp/index.js";

interface PipelineContext {
    data: number[];
}

class ComponentA extends Acmp<PipelineContext> {
    override exec(ctx: PipelineContext, diag?: Adiag): void {
        ctx.data.push(10);
        diag?.ok({ code: "CMP_A_DONE" });
    }
}

class ComponentB extends Acmp<PipelineContext> {
    override exec(ctx: PipelineContext): void {
        ctx.data.push(20);
    }
}

const diag = new Adiag();
const graph = new Agraph({ label: "ComputeFlow", diag });
const flow = new Aflow(graph, diag);

const n1 = flow.addNode({ id: "node1", payload: [new ComponentA()] })!;
const n2 = flow.addNode({ id: "node2", payload: [new ComponentB()] })!;
flow.addLink("node1", "node2");

const ctx: PipelineContext = { data: [] };
flow.run("node1", { ctx });

console.log(ctx.data); // [10, 20]
```

---

## Traversal Modes: `visitMode`

`Aflow` handles convergence (such as diamond topologies where multiple parent nodes link to the same child) using two distinct modes:

```
                    [Root]
                   /      \
             (order: 0)  (order: 1)
                 v          v
             [Node A]    [Node B]
                 \          /
                  v        v
                   [Target]
```

### `visitMode: "path"`
Tracks visited nodes along the active branch only, clearing them during backtracking. Enables shared child nodes to execute repeatedly across distinct parent branches while detecting cycles along individual paths with `RUN_CYCLE_DETECTED`.

```ts
flow.run("root", {
    ctx: myContext,
    visitMode: "path",
});
```

### `visitMode: "once"` (Default)
Maintains a global visited set across the run. Converging branches skip nodes visited on earlier paths, preventing duplicate work on shared downstream nodes.

---

## API

### Components (`Acmp`)
Subclass `Acmp<TCtx>` and implement `exec(ctx: TCtx, diag?: Adiag): void`.

```ts
export class MyComponent extends Acmp<MyContext> {
    override exec(ctx: MyContext, diag?: Adiag): void {
        if (!ctx.ready) {
            diag?.err({ code: "NOT_READY", raw: "Context is not ready" });
            return;
        }
        ctx.value += 1;
    }
}
```

### `Aflow<TCtx>`

```ts
export class Aflow<TCtx = unknown> {
    constructor(graph?: Agraph<Acmp<TCtx, any>[], any>, diag?: Adiag);

    addNode(options?: AflowAddNodeOptions<TCtx>): Anode<Acmp<TCtx, any>[]> | null;
    addPayload(nodeId: string, cmp: Acmp<TCtx, any>): this;
    addPayloads(nodeId: string, cmps: Acmp<TCtx, any>[]): this;
    addLink(srcId: string, dstId: string, options?: AflowAddLinkOptions): Aedge | null;
    sortOutgoingLinks(nodeId: string, sortFn: EdgeSortFn): this;
    sortIncomingLinks(nodeId: string, sortFn: EdgeSortFn): this;
    resetOnceLinks(): void;

    run(from: string, options?: AflowRunOptions<TCtx>): AflowRunResult<TCtx>;
    dryRun(fromNodeId: string, options?: Omit<AflowRunOptions<TCtx>, "_dryRun">): {
        visitOrder: Anode<Acmp<TCtx>[]>[];
        issues: AdiagResult[];
    };
}
```

- **`addLink(srcId, dstId, options?)`**: Inserts a directed link, verifying acyclic invariants via `Adag`. Attaches optional traversal metadata via `options.data`.
- **`sortOutgoingLinks(nodeId, sortFn)`**: Enforces branch execution priority by sorting outgoing edges in place.
- **`run(from, options?)`**: Executes DFS traversal. Passes mutable `options.ctx` and `options.diag` through component payloads. `visitMode` controls whether shared nodes execute once globally (`"once"`) or per-branch with backtracking (`"path"`).
- **`dryRun(fromNodeId, options?)`**: Simulates traversal and evaluates conditional link predicates without executing component payloads.

```ts
export interface AflowLinkData {
    kind?: "pass" | "conditional" | "skip" | "once";
    when?: (ctx: any) => boolean;
    enabled?: boolean;
    order?: number;
}
```

- **`kind`**: Traversal strategy. `"conditional"` evaluates `when(ctx)`, `"skip"` maintains topology while bypassing traversal, and `"once"` executes only on the initial run.
- **`enabled`**: Setting `false` bypasses edge traversal unconditionally.
