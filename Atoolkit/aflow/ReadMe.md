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

class StepA extends Acmp<PipelineContext> {
    override exec(ctx: PipelineContext, diag?: Adiag): void {
        ctx.data.push(10);
        diag?.ok({ code: "STEP_A_DONE" });
    }
}

class StepB extends Acmp<PipelineContext> {
    override exec(ctx: PipelineContext): void {
        ctx.data.push(20);
    }
}

const diag = new Adiag();
const graph = new Agraph({ label: "ComputeFlow", diag });
const flow = new Aflow(graph, diag);

const n1 = flow.addNode({ id: "node1", payload: [new StepA()] })!;
const n2 = flow.addNode({ id: "node2", payload: [new StepB()] })!;
flow.addLink("node1", "node2");

const ctx: PipelineContext = { data: [] };
flow.run("node1", { ctx });

console.log(ctx.data); // [10, 20]
```

---

## Traversal Modes: `visitMode`

`Aflow` handles convergence (such as diamond topologies where multiple parent nodes link to the same child) using two distinct modes:

```
              [Root / RenderPass]
             /                   \
        (order: 0)            (order: 1)
            v                     v
        [Shader A]            [Shader B]
            \                     /
             v                   v
                [DrawMesh Node]
```

### `visitMode: "path"`
Tracks visited nodes along the active branch only, clearing them during backtracking. Enables shared child nodes to execute repeatedly across distinct parent branches while detecting cycles along individual paths with `RUN_CYCLE_DETECTED`.

```ts
flow.run("root", {
    ctx: backend.newCtx(),
    visitMode: "path",
});
```

### `visitMode: "once"` (Default)
Maintains a global visited set across the run. Converging branches skip nodes visited on earlier paths, preventing duplicate work on pass allocations or resource setups.

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

### Node and Payload Operations
- `addNode(options)`: Adds node with payload `Acmp[]` or single `Acmp`.
- `addPayload(nodeId, cmp)`: Appends component to existing node.
- `addPayloads(nodeId, cmps)`: Appends array of components.
- `getNode(id)` / `hasNode(id)`: Looks up node or verifies existence.
- `popNode(id)` / `removeNode(id)`: Removes node and incident edges.

### Link Operations and Types
- `addLink(srcId, dstId, options?)`: Adds directed link, returning null if cycle would form.
- `getLink(id)`: Looks up edge by ID.
- `popLink(id)` / `removeLink(id)`: Removes link.
- `sortOutgoingLinks(nodeId, sortFn)`: Sorts outgoing links to enforce branch order.
- `sortIncomingLinks(nodeId, sortFn)`: Sorts incoming links.
- `resetOnceLinks()`: Resets `_onceFired` flag on `kind: "once"` links.

Link behavior is configured via `data`:

```ts
// "pass" (default): Always traversed
flow.addLink("nodeA", "nodeB", { data: { kind: "pass" } });

// "conditional": Evaluates predicate against context
flow.addLink("renderPass", "postProcess", {
    data: {
        kind: "conditional",
        when: (ctx: MyCtx) => ctx.enablePostProcessing === true,
    }
});

// "skip": Retained in topology but ignored during run()
flow.addLink("shadowMap", "mainPass", { data: { kind: "skip" } });

// "once": Runs on first call, skipped on subsequent calls
flow.addLink("root", "initResources", { data: { kind: "once" } });

// enabled === false skips unconditionally
flow.addLink("nodeA", "nodeB", { data: { enabled: false } });
```

### Traversal and Testing

- `run(fromNodeId, options?)`: Executes DFS traversal from `fromNodeId`.
  - `visitMode`: `"once"` (default) or `"path"`.
  - `ctx`: Context object passed through all components.
  - `onNodeEnter(node, ctx)`: Hook before components execute on node.
  - `onNodeLeave(node, ctx)`: Hook after node and descendants complete.
  - Returns `{ ctx, diag }`.

- `dryRun(fromNodeId, options?)`: Simulates traversal without calling component payloads. Accepts optional `ctx` for conditional link evaluation:
  ```ts
  const { visitOrder, issues } = flow.dryRun("root", {
      ctx: { enablePostProcessing: false },
      visitMode: "path",
  });
  ```
