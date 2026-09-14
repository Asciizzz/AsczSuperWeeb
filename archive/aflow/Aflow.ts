/* Aflow
By Asciiz

Execution flow on top of Agraph.
Can share an Adiag diagnostic collector with its underlying Agraph.
Diagnostics support causal reference chaining (Aflow error points to Agraph error).

# Acmp: base component for node payloads

# Aflow (the wrapper one)

addNode({ payload: Array<Acmp> | Acmp, id: string }?): Anode|null
addLink(srcId: string, dstId: string, { id: string, data: anything }?): Aedge|null

addPayload(nodeId: string, cmp: Acmp): this
addPayloads(nodeId: string, cmps: Acmp[]): this

getNode(id: string): Anode|null
hasNode(id: string): boolean
popNode(id: string): Anode|null
removeNode(id: string): Anode|null

getLink(id: string): Aedge|null
popLink(id: string): Aedge|null
removeLink(id: string): Aedge|null

sortOutgoingLinks(nodeId: string, sortFn: Function): this
sortIncomingLinks(nodeId: string, sortFn: Function): this
* sortFn(edgeA: Aedge, edgeB: Aedge, node?: Anode, graph?: Agraph): number

connectivity(nodeId1: string, nodeId2: string): Aedge[]
hasPath(srcId: string, dstId: string): boolean

run(from: string, { ctx: anything, diag: Adiag }?): { ctx: any, diag: Adiag }
*/

import { Agraph, Adag, Anode, Aedge } from "../agraph/index.js";
import type { EdgeSortFn } from "../agraph/index.js";
import { Adiag, type AdiagResult } from "../../Atoolkit/adiag/index.js";
import { Acmp } from "../acmp/index.js";

export { Agraph, Adag, Anode, Aedge, Adiag, Acmp };
export type { AdiagResult };

// ==================== Types =====================

/**
 * Controls edge traversal behavior during Aflow.run().
 * - "pass"        Always traverse (default)
 * - "conditional" Traverse only if `when(ctx)` returns true
 * - "skip"        Never traverse (structural edge, ignored in execution)
 * - "once"        Traverse only on the first run() call, then never again
 */
export type AflowEdgeKind = "pass" | "conditional" | "skip" | "once";

/**
 * Typed data for Aflow links. Includes built-in control fields
 * plus any user-defined fields via index signature.
 */
export interface AflowLinkData {
    kind?:        AflowEdgeKind;
    when?:        (ctx: any) => boolean;  // used by "conditional" kind
    enabled?:     boolean;   // false = always skip
    order?:       number;    // for sortOutgoingLinks
    _onceFired?:  boolean;   // internal: set to true after "once" edge fires
    [key: string]: unknown;
}

export interface AflowTraversalEntry<TCtx = unknown> {
    link: Aedge | null;
    src: Anode<Acmp<TCtx, any>[]> | null;
    dst: Anode<Acmp<TCtx, any>[]>;
}

export interface AflowAddNodeOptions<TCtx = unknown> {
    payload?: Acmp<TCtx, any>[] | Acmp<TCtx, any>;
    id?: string | null;
}

export interface AflowAddLinkOptions {
    id?: string | null;
    data?: AflowLinkData | null;
}

export interface AflowRunOptions<TCtx = unknown> {
    ctx?:          TCtx;
    diag?:         Adiag;
    /**
     * Controls how nodes are revisited during DFS traversal.
     * - "once" (default): Global visited set. Each node executes at most once across the entire run,
     *   skipping shared downstream nodes reached via multiple paths.
     * - "path": Per-branch active path tracking with backtracking. Nodes can be visited multiple times
     *   across distinct upstream branches, while cycle detection is enforced along each active path.
     */
    visitMode?:    "once" | "path";
    /** Called immediately before a node's components are executed. */
    onNodeEnter?:  (node: Anode<Acmp<TCtx, any>[]>, ctx: TCtx) => void;
    /** Called after all of a node's children have been visited (post-order). */
    onNodeLeave?:  (node: Anode<Acmp<TCtx, any>[]>, ctx: TCtx) => void;
    /** @internal: used by dryRun() to skip component execution */
    _dryRun?:      boolean;
}

export interface AflowRunResult<TCtx = unknown> {
    ctx: TCtx;
    diag?: Adiag;
}


// ==================== Aflow =====================

/**
 * Execution flow engine over Agraph.
 *
 * Supports static invocations:
 * `Aflow.addNode(graph, options)`
 *
 * Or instance orchestration:
 * `const flow = new Aflow(graph, diag)`
 * `flow.addNode(options)`
 */
export class Aflow<TCtx = unknown> {
    graph: Agraph<Acmp<TCtx, any>[], any>;
    #diag?: Adiag;

    constructor(graph: Agraph<Acmp<TCtx, any>[], any> = new Agraph(), diag?: Adiag) {
        this.graph = graph;
        this.#diag = diag;
    }

    /**
     * Diagnostic collector for Aflow.
     * Falls back to `graph.diag` if no Aflow-specific diag was provided.
     */
    get diag(): Adiag | undefined {
        return this.#diag ?? this.graph.diag;
    }

    set diag(d: Adiag | undefined) {
        this.#diag = d;
    }

    // ── Nodes ──────────────────────────────────────────────────────

    /**
     * Add node. Payload runs on visit
     */
    static addNode<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, { payload = [], id = null }: AflowAddNodeOptions<TCtx> = {}): Anode<Acmp<TCtx, any>[]> | null {
        Aflow.#assertGraph(graph, "addNode");
        const normalizedPayload: Acmp<TCtx, any>[] = Array.isArray(payload) ? payload : (payload ? [payload] : []);
        const node = graph.addNode({ id, data: normalizedPayload });

        if (!node && graph.diag) {
            // Causal reference chaining: if Aflow had its own diag separate from graph
            const cause = graph.diag.lastErr();
            if (cause) {
                // If graph already logged error, it's recorded
            }
        }

        return node;
    }

    addNode(options: AflowAddNodeOptions<TCtx> = {}): Anode<Acmp<TCtx, any>[]> | null {
        const node = Aflow.addNode(this.graph, options);
        if (!node && this.diag && this.diag !== this.graph.diag) {
            this.diag.err({
                code: "AFLOW_ADD_NODE_FAILED",
                raw: 'Aflow.addNode failed: could not add node to underlying graph',
                ref: this.graph.diag?.lastErr() ?? null,
            });
        }
        return node;
    }

    static addPayload<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, nodeId: string, cmp: Acmp<TCtx, any>): typeof Aflow {
        const node = graph.getNode(nodeId);
        if (!node) {
            graph.diag?.err({
                code: "ADD_PAYLOAD_FAILED",
                raw: 'Aflow.addPayload: node "$nodeId$" does not exist',
                data: { nodeId }
            });
            return Aflow;
        }
        if (!Array.isArray(node.data)) {
            graph.diag?.err({
                code: "ADD_PAYLOAD_FAILED",
                raw: 'Aflow.addPayload: node "$nodeId$" data is not an array',
                data: { nodeId }
            });
            return Aflow;
        }
        node.data.push(cmp);
        return Aflow;
    }

    addPayload(nodeId: string, cmp: Acmp<TCtx, any>): this {
        Aflow.addPayload(this.graph, nodeId, cmp);
        return this;
    }

    static addPayloads<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, nodeId: string, cmps: Acmp<TCtx, any>[]): typeof Aflow {
        const node = graph.getNode(nodeId);
        if (!node) {
            graph.diag?.err({
                code: "ADD_PAYLOADS_FAILED",
                raw: 'Aflow.addPayloads: node "$nodeId$" does not exist',
                data: { nodeId }
            });
            return Aflow;
        }
        if (!Array.isArray(node.data)) {
            graph.diag?.err({
                code: "ADD_PAYLOADS_FAILED",
                raw: 'Aflow.addPayloads: node "$nodeId$" data is not an array',
                data: { nodeId }
            });
            return Aflow;
        }
        node.data.push(...cmps);
        return Aflow;
    }

    addPayloads(nodeId: string, cmps: Acmp<TCtx, any>[]): this {
        Aflow.addPayloads(this.graph, nodeId, cmps);
        return this;
    }

    static getNode<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, id: string): Anode<Acmp<TCtx, any>[]> | null {
        Aflow.#assertGraph(graph, "getNode");
        return graph.getNode(id);
    }

    getNode(id: string): Anode<Acmp<TCtx, any>[]> | null {
        return Aflow.getNode(this.graph, id);
    }

    static hasNode<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, id: string): boolean {
        Aflow.#assertGraph(graph, "hasNode");
        return graph.hasNode(id);
    }

    hasNode(id: string): boolean {
        return Aflow.hasNode(this.graph, id);
    }

    /**
     * Removes node and its incident links from the graph, returning the removed node.
     */
    static popNode<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, id: string): Anode<Acmp<TCtx, any>[]> | null {
        Aflow.#assertGraph(graph, "popNode");
        return graph.popNode(id);
    }

    popNode(id: string): Anode<Acmp<TCtx, any>[]> | null {
        return Aflow.popNode(this.graph, id);
    }

    /** Alias for `popNode` */
    static removeNode<TCtx>(graph: Agraph<Acmp<TCtx, any>[], any>, id: string): Anode<Acmp<TCtx, any>[]> | null {
        return Aflow.popNode(graph, id);
    }

    /** Alias for `popNode` */
    removeNode(id: string): Anode<Acmp<TCtx>[]> | null {
        return this.popNode(id);
    }

    // ── Links ──────────────────────────────────────────────────────

    /**
     * Adds a directed link between nodes. Setting `data.enabled = false` skips traversal during run.
     */
    static addLink(graph: Agraph<any, any>, srcId: string, dstId: string, { data = null, id = null }: AflowAddLinkOptions = {}): Aedge | null {
        Aflow.#assertGraph(graph, "addLink");

        if (!graph.hasNode(srcId)) {
            graph.diag?.err({
                code: "ADD_LINK_FAILED",
                raw: 'Aflow.addLink: source node "$srcId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }
        if (!graph.hasNode(dstId)) {
            graph.diag?.err({
                code: "ADD_LINK_FAILED",
                raw: 'Aflow.addLink: destination node "$dstId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }

        return Adag.addEdge(graph, srcId, dstId, { id, data: data as object });
    }

    addLink(srcId: string, dstId: string, options: AflowAddLinkOptions = {}): Aedge | null {
        const link = Aflow.addLink(this.graph, srcId, dstId, options);
        if (!link && this.diag && this.diag !== this.graph.diag) {
            this.diag.err({
                code: "AFLOW_ADD_LINK_FAILED",
                raw: 'Aflow.addLink failed: could not add link "$srcId$" -> "$dstId$"',
                data: { srcId, dstId },
                ref: this.graph.diag?.lastErr() ?? null,
            });
        }
        return link;
    }

    static getLink(graph: Agraph<any, any>, id: string): Aedge | null {
        Aflow.#assertGraph(graph, "getLink");
        return graph.getEdge(id);
    }

    getLink(id: string): Aedge | null {
        return Aflow.getLink(this.graph, id);
    }

    /**
     * Removes a link from the graph and returns it.
     */
    static popLink(graph: Agraph<any, any>, id: string): Aedge | null {
        Aflow.#assertGraph(graph, "popLink");
        return graph.popEdge(id);
    }

    popLink(id: string): Aedge | null {
        return Aflow.popLink(this.graph, id);
    }

    /** Alias for `popLink` */
    static removeLink(graph: Agraph<any, any>, id: string): Aedge | null {
        return Aflow.popLink(graph, id);
    }

    /** Alias for `popLink` */
    removeLink(id: string): Aedge | null {
        return this.popLink(id);
    }

    // ── Link Sorting ───────────────────────────────────────────────

    /**
     * Sorts outgoing links of a node in place.
     */
    static sortOutgoingLinks(graph: Agraph<any, any>, nodeId: string, sortFn: EdgeSortFn): void {
        Aflow.#assertGraph(graph, "sortOutgoingLinks");
        graph.sortOutgoingEdges(nodeId, sortFn);
    }

    sortOutgoingLinks(nodeId: string, sortFn: EdgeSortFn): this {
        Aflow.sortOutgoingLinks(this.graph, nodeId, sortFn);
        return this;
    }

    /**
     * In-place sort the incoming links of a node
     */
    static sortIncomingLinks(graph: Agraph<any, any>, nodeId: string, sortFn: EdgeSortFn = defaultLinkSortFn): void {
        Aflow.#assertGraph(graph, "sortIncomingLinks");
        graph.sortIncomingEdges(nodeId, sortFn);
    }

    sortIncomingLinks(nodeId: string, sortFn: EdgeSortFn = defaultLinkSortFn): this {
        Aflow.sortIncomingLinks(this.graph, nodeId, sortFn);
        return this;
    }

    // ── Queries ────────────────────────────────────────────────────

    static connectivity(graph: Agraph<any, any>, nodeId1: string, nodeId2: string): Aedge[] {
        Aflow.#assertGraph(graph, "connectivity");
        return graph.edgesConnecting(nodeId1, nodeId2);
    }

    connectivity(nodeId1: string, nodeId2: string): Aedge[] {
        return Aflow.connectivity(this.graph, nodeId1, nodeId2);
    }

    static hasPath(graph: Agraph<any, any>, srcId: string, dstId: string): boolean {
        Aflow.#assertGraph(graph, "hasPath");
        return graph.hasPath(srcId, dstId);
    }

    hasPath(srcId: string, dstId: string): boolean {
        return Aflow.hasPath(this.graph, srcId, dstId);
    }

    // ── Run ────────────────────────────────────────────────────────

    /**
     * Run DFS from `from`. Components receive `(ctx, diag)` directly.
     */
    static run<TCtx>(
        graph: Agraph<Acmp<TCtx>[], any>,
        from: string,
        {
            ctx = {} as TCtx,
            diag,
            visitMode = "once",
            onNodeEnter,
            onNodeLeave,
            _dryRun = false,
        }: AflowRunOptions<TCtx> = {}
    ): AflowRunResult<TCtx> {
        Aflow.#assertGraph(graph, "run");
        const activeDiag = diag ?? graph.diag;

        if (from == null) {
            activeDiag?.err({ code: "RUN_FAILED", raw: 'Aflow.run: "from" node id is required' });
            return { ctx, diag: activeDiag };
        }

        const rootNode = graph.getNode(from);
        if (!rootNode) {
            activeDiag?.err({ code: "RUN_FAILED", raw: 'Aflow.run: starting node "$from$" does not exist', data: { from } });
            return { ctx, diag: activeDiag };
        }

        // Stack frames: "enter" visits a node, "leave" backtracks (for path-mode + onNodeLeave)
        type EnterFrame = { kind: "enter"; entry: AflowTraversalEntry<TCtx> };
        type LeaveFrame = { kind: "leave"; node: Anode<Acmp<TCtx>[]> };
        type StackFrame = EnterFrame | LeaveFrame;

        const stack: StackFrame[] = [{ kind: "enter", entry: { link: null, src: null, dst: rootNode } }];

        // "path" mode: tracks nodes on current active DFS branch (for cycle detection with backtracking)
        const currentPath = new Set<string>();
        // "once" mode: global visited guard (ensures single-pass task execution)
        const globalVisited = new Set<string>();

        const needsLeaveFrame = visitMode === "path" || onNodeLeave != null;

        while (stack.length > 0) {
            const frame = stack.pop()!;

            // --- Leave frame: backtrack ---
            if (frame.kind === "leave") {
                currentPath.delete(frame.node.id);
                if (onNodeLeave) onNodeLeave(frame.node, ctx);
                continue;
            }

            // --- Enter frame ---
            const { entry } = frame;
            const node = entry.dst;

            // Visit guard
            if (visitMode === "path") {
                if (currentPath.has(node.id)) {
                    activeDiag?.err({
                        code: "RUN_CYCLE_DETECTED",
                        raw: 'Aflow.run: cycle detected at node "$nodeId$"',
                        data: { nodeId: node.id }
                    });
                    return { ctx, diag: activeDiag };
                }
                currentPath.add(node.id);
            } else {
                // "once": skip already-visited nodes
                if (globalVisited.has(node.id)) continue;
                globalVisited.add(node.id);
            }

            onNodeEnter?.(node, ctx);

            // Validate payload
            const nodeData = node.data;
            if (!Array.isArray(nodeData)) {
                if (visitMode === "path") currentPath.delete(node.id);
                activeDiag?.err({ code: "RUN_INVALID_PAYLOAD", raw: 'Aflow.run: node "$nodeId$" data is not an array', data: { nodeId: node.id } });
                return { ctx, diag: activeDiag };
            }

            // Execute components (skipped in dry-run mode)
            if (!_dryRun) {
                for (let i = 0; i < nodeData.length; i++) {
                    const cmp = nodeData[i];
                    if (!(cmp instanceof Acmp)) {
                        if (visitMode === "path") currentPath.delete(node.id);
                        activeDiag?.err({ code: "RUN_INVALID_CMP", raw: 'Aflow.run: node "$nodeId$" payload[$index$] is not an Acmp instance', data: { nodeId: node.id, index: i } });
                        return { ctx, diag: activeDiag };
                    }

                    const errsBefore = activeDiag?.findErrs().length ?? 0;
                    cmp.exec(ctx, activeDiag);
                    const errsAfter = activeDiag?.findErrs().length ?? 0;

                    if (errsAfter > errsBefore) {
                        const causeErr = activeDiag!.lastErr();
                        activeDiag!.err({
                            code: "RUN_CMP_FAILED",
                            raw: 'Aflow.run: node "$nodeId$" component[$index$] failed',
                            data: { nodeId: node.id, index: i },
                            ref: causeErr
                        });
                        if (visitMode === "path") currentPath.delete(node.id);
                        return { ctx, diag: activeDiag };
                    }
                }
            }

            // Push children
            const outEdges = graph.outEdges(node.id);

            // Push leave frame BEFORE children so it fires after all children complete
            if (needsLeaveFrame) {
                stack.push({ kind: "leave", node });
            }

            // Push children in reverse order (LIFO: first child executes first)
            for (let i = outEdges.length - 1; i >= 0; i--) {
                const edge = outEdges[i];

                // --- Edge filtering ---
                const meta = edge.data as AflowLinkData | null | undefined;

                // enabled === false skips the edge
                if (meta?.enabled === false) continue;

                const kind = meta?.kind ?? "pass";

                if (kind === "skip") continue;

                if (kind === "conditional") {
                    if (typeof meta?.when !== "function" || !meta.when(ctx)) continue;
                }

                if (kind === "once") {
                    if (meta?._onceFired) continue;
                    if (meta) (meta as AflowLinkData)._onceFired = true;
                }

                const dstNode = graph.getNode(edge.dstId);
                if (!dstNode) {
                    activeDiag?.err({
                        code: "RUN_DANGLING_LINK",
                        raw: 'Aflow.run: link "$linkId$" points to non-existent node "$dstId$"',
                        data: { linkId: edge.id, dstId: edge.dstId }
                    });
                    return { ctx, diag: activeDiag };
                }

                stack.push({ kind: "enter", entry: { link: edge, src: node, dst: dstNode } });
            }
        }

        activeDiag?.ok({ code: "RUN_OK", data: { from } });
        return { ctx, diag: activeDiag };
    }

    /**
     * Run DFS from `from`. Components receive `(ctx, diag)` directly.
     */
    run(from: string, options: AflowRunOptions<TCtx> = {}): AflowRunResult<TCtx> {
        return Aflow.run(this.graph, from, { diag: this.diag, ...options });
    }

    /**
     * Traverses the flow graph without executing any components.
     * Applies the same edge filtering and visitMode logic as run().
     * Returns the ordered list of nodes that would be visited and any structural issues found.
     */
    dryRun(
        fromNodeId: string,
        options: Omit<AflowRunOptions<TCtx>, "_dryRun"> = {}
    ): { visitOrder: Anode<Acmp<TCtx>[]>[]; issues: AdiagResult[] } {
        const dryDiag = new Adiag();
        const visitOrder: Anode<Acmp<TCtx>[]>[] = [];
        const originalOnNodeEnter = options.onNodeEnter;

        Aflow.run<TCtx>(this.graph, fromNodeId, {
            ...options,
            ctx:          options.ctx ?? ({} as TCtx),
            diag:         dryDiag,
            _dryRun:      true,
            onNodeEnter:  (node, ctx) => {
                visitOrder.push(node);
                originalOnNodeEnter?.(node, ctx);
            },
        });

        return { visitOrder, issues: dryDiag.findErrs() };
    }

    /**
     * Resets the `_onceFired` flag on all links with `kind: "once"`,
     * allowing them to be traversed again on the next run().
     */
    static resetOnceLinks(graph: Agraph<any, any>): void {
        Aflow.#assertGraph(graph, "resetOnceLinks");
        for (const edge of graph.edges.values()) {
            const meta = edge.data as AflowLinkData | null | undefined;
            if (meta && meta.kind === "once") {
                meta._onceFired = false;
            }
        }
    }

    resetOnceLinks(): this {
        Aflow.resetOnceLinks(this.graph);
        return this;
    }

    static #assertGraph(graph: Agraph, method: string): void {
        if (!(graph instanceof Agraph)) {
            throw new TypeError(`Aflow.${method}: graph must be an Agraph instance`);
        }
    }
}

// ==================== Helpers =====================

function defaultLinkSortFn(_a: Aedge, _b: Aedge): number {
    return 0;
}
