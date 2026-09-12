import { Adiag, type AdiagResult } from "../../Atoolkit/adiag/index.js";
declare function structuredClone<T>(value: T, options?: any): T;

function _safeClone<T>(val: T): T {
    try {
        return structuredClone(val);
    } catch {
        // Fallback for non-cloneable objects (functions, Acmp instances, GPU handles)
        if (Array.isArray(val)) return [...val] as unknown as T;
        if (val && typeof val === "object") return { ...val } as T;
        return val;
    }
}

/* Agraph
By Asciiz

Tiny directed graph. Stores topology only, traversal is your job.
If `diag` is provided to the Agraph instance, diagnostics (ok/err/warn/info) are automatically recorded.
If `diag` is NOT provided, failed operations silently return null/empty values without throwing.

# Methods:

addNode({ data?: any, id?: string }?)               -> Anode|null
getNode(id: string)                                 -> Anode|null
hasNode(id: string)                                 -> boolean
popNode(id: string)                                 -> Anode|null (removes & returns node + cascade unlinks edges)
removeNode(id: string)                              -> alias for popNode
getNodes()                                          -> Anode[]

addEdge(srcId: string, dstId: string, {
    data?: any, id?: string
}?)                                                 -> Aedge|null
getEdge(id: string)                                 -> Aedge|null
hasEdge(id: string)                                 -> boolean
popEdge(id: string)                                 -> Aedge|null (removes & returns edge)
removeEdge(id: string)                              -> alias for popEdge
getEdges()                                          -> Aedge[]

edgesOf(nodeId: string, { direction: string })      -> Aedge[]
outEdges(nodeId: string)                            -> Aedge[]
inEdges(nodeId: string)                             -> Aedge[]
edgesBetween(srcId: string, dstId: string)          -> Aedge[]
edgesConnecting(nodeId1: string, nodeId2: string)   -> Aedge[]

sortIncomingEdges(nodeId: string, compareFn: Func)  -> Aedge[]
sortOutgoingEdges(nodeId: string, compareFn: Func)  -> Aedge[]

connectionsOf(nodeId: string, { direction: string })-> Array<{from:Anode, to:Anode, edge:Aedge, dir:string}>
neighborsOf(nodeId: string, { direction: string })  -> Anode[]
successors(nodeId: string)                          -> Anode[]
predecessors(nodeId: string)                        -> Anode[]

degree(nodeId: string)                              -> number
outDegree(nodeId: string)                           -> number
inDegree(nodeId: string)                            -> number

forEachNode(fn: Func)                               -> void
forEachEdge(fn: Func)                               -> void
filterNodes(fn: Func)                               -> Anode[]|null
filterEdges(fn: Func)                               -> Aedge[]|null

serialize(options?: SerializeOptions)               -> string|null
deserialize(json: string, options?: DeserializeOptions) -> Agraph|null
*/

// ==================== Types =====================

export type Direction = "out" | "in" | "both";

export interface AgraphOptions {
    label?: string;
    diag?: Adiag;
}

export interface AddNodeOptions<TData = any> {
    data?: TData;
    id?: string | null;
}

export interface AddEdgeOptions<TData = any> {
    data?: TData;
    id?: string | null;
}

export interface DirectionOptions {
    direction?: Direction;
}

export interface ClearOptions {
    resetIds?: boolean;
}

export interface SerializeOptions<NData = any, EData = any> {
    nodeSerializer?: (data: NData) => any;
    edgeSerializer?: (data: EData) => any;
    replacer?: (key: string, value: any) => any;
    space?: string | number;
}

export interface DeserializeOptions<NData = any, EData = any> {
    diag?: Adiag;
    nodeDeserializer?: (rawNodeData: any) => NData;
    edgeDeserializer?: (rawEdgeData: any) => EData;
    reviver?: (key: string, value: any) => any;
}

export interface Connection<NData = any, EData = any> {
    from: Anode<NData>;
    to: Anode<NData> | null;
    edge: Aedge<EData>;
    dir: string;
}

export type EdgeSortFn<NData = any, EData = any> = (edgeA: Aedge<EData>, edgeB: Aedge<EData>, node?: Anode<NData> | null, graph?: Agraph<NData, EData>) => number;

// ==================== Anode =====================

export class Anode<TData = any> {
    readonly #id: string;
    data: TData;

    constructor(id: string, data: TData = {} as TData) {
        this.#id = id;
        this.data = data;
    }

    get id(): string { return this.#id; }
}

// ==================== Aedge =====================

export class Aedge<TData = any> {
    readonly #id: string;
    readonly #srcId: string;
    readonly #dstId: string;
    data: TData;

    constructor(id: string, srcId: string, dstId: string, data: TData = {} as TData) {
        this.#id    = id;
        this.#srcId = srcId;
        this.#dstId = dstId;
        this.data   = data;
    }

    get id():    string { return this.#id; }
    get srcId(): string { return this.#srcId; }
    get dstId(): string { return this.#dstId; }
}

// ==================== Generic directed graph =====================

export class Agraph<NData = any, EData = any> {
    static readonly OUT  = "out"  as const;
    static readonly IN   = "in"   as const;
    static readonly BOTH = "both" as const;

    static readonly SELF    = "self"    as const;
    static readonly UNKNOWN = "unknown" as const;

    label:        string;
    diag?:        Adiag;
    nodes:        Map<string, Anode<NData>>;
    edges:        Map<string, Aedge<EData>>;
    outgoing:     Map<string, Set<string>>;
    incoming:     Map<string, Set<string>>;
    _nextNodeId:  number;
    _nextEdgeId:  number;

    /** @internal: cached topoSort result. Invalidated on every topology mutation. */
    #topoCache:  Anode<NData>[] | null = null;
    #topoDirty = true;

    static isDirection(direction: string): direction is Direction {
        return direction === Agraph.OUT ||
               direction === Agraph.IN  ||
               direction === Agraph.BOTH;
    }

    constructor({ label = "", diag }: AgraphOptions = {}) {
        this.label = label;
        this.diag = diag;

        this.nodes    = new Map(); // nodeId -> Anode
        this.edges    = new Map(); // edgeId -> Aedge

        this.outgoing = new Map(); // nodeId -> Set<edgeId>
        this.incoming = new Map(); // nodeId -> Set<edgeId>

        this._nextNodeId = 0;
        this._nextEdgeId = 0;
    }

    makeNodeId(): string { return `${this.label}_n${this._nextNodeId++}`; }
    makeEdgeId(): string { return `${this.label}_e${this._nextEdgeId++}`; }

    // ── Nodes ──────────────────────────────────────────────────────

    addNode({ data = {} as NData, id = null }: AddNodeOptions<NData> = {}): Anode<NData> | null {
        const nodeId = id ?? this.makeNodeId();

        if (this.nodes.has(nodeId)) {
            this.diag?.err({
                code: "ADD_NODE_FAILED",
                raw: 'Could not add node "$nodeId$": node already exists',
                data: { nodeId }
            });
            return null;
        }

        const node = new Anode(nodeId, data);

        this.nodes.set(nodeId, node);
        this.outgoing.set(nodeId, new Set<string>());
        this.incoming.set(nodeId, new Set<string>());

        this.#topoDirty = true;
        this.#topoCache = null;

        this.diag?.ok({ code: "ADD_NODE_OK", data: { nodeId } });
        return node;
    }

    getNode(id: string): Anode<NData> | null { return this.nodes.get(id) ?? null; }
    hasNode(id: string): boolean       { return this.nodes.has(id); }

    /**
     * Removes a node and all its incident edges from the graph, returning the removed node.
     * Silently returns null if node does not exist (and logs to diag if available).
     */
    popNode(id: string): Anode<NData> | null {
        const node = this.nodes.get(id);

        if (!node) {
            this.diag?.err({
                code: "POP_NODE_FAILED",
                raw: 'Could not pop node "$id$": node does not exist',
                data: { id }
            });
            return null;
        }

        const edgeIds = new Set([
            ...this.outgoing.get(id)!,
            ...this.incoming.get(id)!
        ]);

        for (const edgeId of edgeIds) {
            this.popEdge(edgeId);
        }

        this.nodes.delete(id);
        this.outgoing.delete(id);
        this.incoming.delete(id);

        this.#topoDirty = true;
        this.#topoCache = null;

        this.diag?.ok({ code: "POP_NODE_OK", data: { id } });
        return node;
    }

    /** Alias for `popNode` */
    removeNode(id: string): Anode<NData> | null {
        return this.popNode(id);
    }

    getNodes(): Anode<NData>[]  { return [...this.nodes.values()]; }
    get nodeCount(): number { return this.nodes.size; }

    // ── Edges ──────────────────────────────────────────────────────

    addEdge(srcId: string, dstId: string, { data = {} as EData, id = null }: AddEdgeOptions<EData> = {}): Aedge<EData> | null {
        if (srcId == null) {
            this.diag?.err({
                code: "ADD_EDGE_FAILED",
                raw: "Could not add edge: srcId is required",
                data: { srcId, dstId }
            });
            return null;
        }
        if (dstId == null) {
            this.diag?.err({
                code: "ADD_EDGE_FAILED",
                raw: "Could not add edge: dstId is required",
                data: { srcId, dstId }
            });
            return null;
        }

        if (!this.nodes.has(srcId)) {
            this.diag?.err({
                code: "ADD_EDGE_FAILED",
                raw: 'Could not add edge "$srcId$" -> "$dstId$": source node does not exist',
                data: { srcId, dstId }
            });
            return null;
        }
        if (!this.nodes.has(dstId)) {
            this.diag?.err({
                code: "ADD_EDGE_FAILED",
                raw: 'Could not add edge "$srcId$" -> "$dstId$": destination node does not exist',
                data: { srcId, dstId }
            });
            return null;
        }

        const edgeId = id ?? this.makeEdgeId();

        if (this.edges.has(edgeId)) {
            this.diag?.err({
                code: "ADD_EDGE_FAILED",
                raw: 'Could not add edge "$edgeId$": edge already exists',
                data: { edgeId, srcId, dstId }
            });
            return null;
        }

        const edge = new Aedge(edgeId, srcId, dstId, data);

        this.edges.set(edgeId, edge);
        this.outgoing.get(srcId)!.add(edgeId);
        this.incoming.get(dstId)!.add(edgeId);

        this.#topoDirty = true;
        this.#topoCache = null;

        this.diag?.ok({ code: "ADD_EDGE_OK", data: { edgeId, srcId, dstId } });
        return edge;
    }

    getEdge(id: string): Aedge<EData> | null { return this.edges.get(id) ?? null; }
    hasEdge(id: string): boolean       { return this.edges.has(id); }

    /**
     * Removes an edge from the graph and returns it.
     * Silently returns null if edge does not exist (and logs to diag if available).
     */
    popEdge(id: string): Aedge<EData> | null {
        const edge = this.edges.get(id);

        if (!edge) {
            this.diag?.err({
                code: "POP_EDGE_FAILED",
                raw: 'Could not pop edge "$id$": edge does not exist',
                data: { id }
            });
            return null;
        }

        this.outgoing.get(edge.srcId)?.delete(id);
        this.incoming.get(edge.dstId)?.delete(id);
        this.edges.delete(id);

        this.#topoDirty = true;
        this.#topoCache = null;

        this.diag?.ok({ code: "POP_EDGE_OK", data: { id } });
        return edge;
    }

    /** Alias for `popEdge` */
    removeEdge(id: string): Aedge<EData> | null {
        return this.popEdge(id);
    }

    getEdges(): Aedge<EData>[]       { return [...this.edges.values()]; }
    get edgeCount(): number   { return this.edges.size; }

    // ── Direction / edge queries ───────────────────────────────────

    /**
     * Edges touching `nodeId`, filtered by direction
     */
    edgesOf(nodeId: string, { direction = Agraph.OUT }: DirectionOptions = {}): Aedge<EData>[] {
        if (!Agraph.isDirection(direction)) return [];
        if (!this.nodes.has(nodeId)) return [];

        if (direction === Agraph.OUT) {
            return this.#edgesFromIds(this.outgoing.get(nodeId));
        }

        if (direction === Agraph.IN) {
            return this.#edgesFromIds(this.incoming.get(nodeId));
        }

        const edgeIds = new Set([
            ...this.outgoing.get(nodeId)!,
            ...this.incoming.get(nodeId)!
        ]);

        return this.#edgesFromIds(edgeIds);
    }

    outEdges(nodeId: string): Aedge<EData>[] {
        return this.edgesOf(nodeId, { direction: Agraph.OUT });
    }

    inEdges(nodeId: string): Aedge<EData>[] {
        return this.edgesOf(nodeId, { direction: Agraph.IN });
    }

    /**
     * In-place sort the outgoing edges of a node
     */
    sortOutgoingEdges(nodeId: string, sortFn: EdgeSortFn): Aedge<EData>[] {
        if (typeof sortFn !== "function") {
            this.diag?.err({
                code: "SORT_OUTGOING_EDGES_FAILED",
                raw: 'Could not sort outgoing edges of node "$nodeId$": sortFn must be a function',
                data: { nodeId }
            });
            return [];
        }
        const edgeIdSet = this.outgoing.get(nodeId);
        if (!edgeIdSet) return [];
        const node = this.getNode(nodeId);
        const edges: Aedge<EData>[] = [];
        for (const id of edgeIdSet) {
            const edge = this.edges.get(id);
            if (edge) edges.push(edge);
        }
        edges.sort((a, b) => sortFn(a, b, node, this));
        this.outgoing.set(nodeId, new Set(edges.map(e => e.id)));
        this.#topoDirty = true;
        this.#topoCache = null;
        this.diag?.ok({ code: "SORT_OUTGOING_EDGES_OK", data: { nodeId } });
        return edges;
    }

    /**
     * In-place sort the incoming edges of a node
     */
    sortIncomingEdges(nodeId: string, sortFn: EdgeSortFn): Aedge<EData>[] {
        if (typeof sortFn !== "function") {
            this.diag?.err({
                code: "SORT_INCOMING_EDGES_FAILED",
                raw: 'Could not sort incoming edges of node "$nodeId$": sortFn must be a function',
                data: { nodeId }
            });
            return [];
        }
        const edgeIdSet = this.incoming.get(nodeId);
        if (!edgeIdSet) return [];
        const node = this.getNode(nodeId);
        const edges: Aedge<EData>[] = [];
        for (const id of edgeIdSet) {
            const edge = this.edges.get(id);
            if (edge) edges.push(edge);
        }
        edges.sort((a, b) => sortFn(a, b, node, this));
        this.incoming.set(nodeId, new Set(edges.map(e => e.id)));
        this.#topoDirty = true;
        this.#topoCache = null;
        this.diag?.ok({ code: "SORT_INCOMING_EDGES_OK", data: { nodeId } });

        return edges;
    }

    edgesBetween(srcId: string, dstId: string): Aedge<EData>[] {
        if (!this.nodes.has(srcId) || !this.nodes.has(dstId)) return [];

        const outEdgeIds = this.outgoing.get(srcId);
        if (!outEdgeIds) return [];

        const result: Aedge<EData>[] = [];
        for (const edgeId of outEdgeIds) {
            const edge = this.edges.get(edgeId);
            if (edge && edge.dstId === dstId) result.push(edge);
        }
        return result;
    }

    /**
     * Edges between `nodeId1` and `nodeId2`, both ways
     */
    edgesConnecting(nodeId1: string, nodeId2: string): Aedge<EData>[] {
        if (!this.nodes.has(nodeId1) || !this.nodes.has(nodeId2)) return [];

        const edgeIds = new Set<string>();
        for (const edge of this.edgesBetween(nodeId1, nodeId2)) edgeIds.add(edge.id);
        for (const edge of this.edgesBetween(nodeId2, nodeId1)) edgeIds.add(edge.id);

        return this.#edgesFromIds(edgeIds);
    }

    // ── Connection / neighbor queries ──────────────────────────────

    /**
     * Neighbor links with resolved nodes + dir tag
     */
    connectionsOf(nodeId: string, { direction = Agraph.OUT }: DirectionOptions = {}): Connection[] {
        if (!Agraph.isDirection(direction)) return [];
        if (!this.nodes.has(nodeId)) return [];

        const node  = this.getNode(nodeId)!;
        const edges = this.edgesOf(nodeId, { direction });

        const result: Connection[] = [];
        for (const edge of edges) {
            const dir =
                edge.srcId === edge.dstId ? Agraph.SELF    :
                edge.srcId === nodeId     ? Agraph.OUT     :
                edge.dstId === nodeId     ? Agraph.IN      :
                Agraph.UNKNOWN;

            const otherNodeId = dir === Agraph.OUT ? edge.dstId : edge.srcId;
            result.push({ from: node, to: this.getNode(otherNodeId), edge, dir });
        }

        return result;
    }

    /**
     * Unique neighbor nodes
     */
    neighborsOf(nodeId: string, { direction = Agraph.OUT }: DirectionOptions = {}): Anode<NData>[] {
        if (!Agraph.isDirection(direction)) return [];
        if (!this.nodes.has(nodeId)) return [];

        const seen = new Set<string>();
        const result: Anode<NData>[] = [];

        if (direction === Agraph.OUT || direction === Agraph.BOTH) {
            const outIds = this.outgoing.get(nodeId);
            if (outIds) {
                for (const edgeId of outIds) {
                    const edge = this.edges.get(edgeId);
                    if (edge && !seen.has(edge.dstId)) {
                        seen.add(edge.dstId);
                        const node = this.nodes.get(edge.dstId);
                        if (node) result.push(node);
                    }
                }
            }
        }

        if (direction === Agraph.IN || direction === Agraph.BOTH) {
            const inIds = this.incoming.get(nodeId);
            if (inIds) {
                for (const edgeId of inIds) {
                    const edge = this.edges.get(edgeId);
                    if (edge && !seen.has(edge.srcId)) {
                        seen.add(edge.srcId);
                        const node = this.nodes.get(edge.srcId);
                        if (node) result.push(node);
                    }
                }
            }
        }

        return result;
    }

    successors(nodeId: string):   Anode<NData>[] { return this.neighborsOf(nodeId, { direction: Agraph.OUT }); }
    predecessors(nodeId: string): Anode<NData>[] { return this.neighborsOf(nodeId, { direction: Agraph.IN }); }

    /** Total degree; self-loop counts once. */
    degree(nodeId: string): number {
        const outSet = this.outgoing.get(nodeId);
        const inSet  = this.incoming.get(nodeId);
        if (!outSet && !inSet) return 0;
        if (!outSet) return inSet!.size;
        if (!inSet) return outSet!.size;

        let count = outSet.size;
        for (const id of inSet) {
            if (!outSet.has(id)) count++;
        }
        return count;
    }
    outDegree(nodeId: string): number { return this.outgoing.get(nodeId)?.size ?? 0; }
    inDegree(nodeId: string):  number { return this.incoming.get(nodeId)?.size ?? 0; }

    // ── Iteration helpers ──────────────────────────────────────────

    forEachNode(fn: (node: Anode<NData>) => void): void {
        try {
            for (const node of this.nodes.values()) fn(node);
            this.diag?.ok({ code: "FOR_EACH_NODE_OK" });
        } catch (error) {
            this.diag?.err({
                code: "FOR_EACH_NODE_FAILED",
                raw: "Node callback failed: $error$",
                data: { error }
            });
        }
    }

    forEachEdge(fn: (edge: Aedge<EData>) => void): void {
        try {
            for (const edge of this.edges.values()) fn(edge);
            this.diag?.ok({ code: "FOR_EACH_EDGE_OK" });
        } catch (error) {
            this.diag?.err({
                code: "FOR_EACH_EDGE_FAILED",
                raw: "Edge callback failed: $error$",
                data: { error }
            });
        }
    }

    filterNodes(fn: (node: Anode<NData>) => boolean): Anode<NData>[] | null {
        try {
            const result: Anode<NData>[] = [];
            for (const node of this.nodes.values()) {
                if (fn(node)) result.push(node);
            }
            this.diag?.ok({ code: "FILTER_NODES_OK" });
            return result;
        } catch (error) {
            this.diag?.err({
                code: "FILTER_NODES_FAILED",
                raw: "Node filter callback failed: $error$",
                data: { error }
            });
            return null;
        }
    }

    filterEdges(fn: (edge: Aedge<EData>) => boolean): Aedge<EData>[] | null {
        try {
            const result: Aedge<EData>[] = [];
            for (const edge of this.edges.values()) {
                if (fn(edge)) result.push(edge);
            }
            this.diag?.ok({ code: "FILTER_EDGES_OK" });
            return result;
        } catch (error) {
            this.diag?.err({
                code: "FILTER_EDGES_FAILED",
                raw: "Edge filter callback failed: $error$",
                data: { error }
            });
            return null;
        }
    }

    mapNodeData<T>(fn: (node: Anode<NData>) => T): T[] | null {
        try {
            const result: T[] = [];
            for (const node of this.nodes.values()) result.push(fn(node));
            this.diag?.ok({ code: "MAP_NODE_DATA_OK" });
            return result;
        } catch (error) {
            this.diag?.err({
                code: "MAP_NODE_DATA_FAILED",
                raw: "Node mapper callback failed: $error$",
                data: { error }
            });
            return null;
        }
    }

    mapEdgeData<T>(fn: (edge: Aedge<EData>) => T): T[] | null {
        try {
            const result: T[] = [];
            for (const edge of this.edges.values()) result.push(fn(edge));
            this.diag?.ok({ code: "MAP_EDGE_DATA_OK" });
            return result;
        } catch (error) {
            this.diag?.err({
                code: "MAP_EDGE_DATA_FAILED",
                raw: "Edge mapper callback failed: $error$",
                data: { error }
            });
            return null;
        }
    }

    // ── Graph-level queries ────────────────────────────────────────

    /** Nodes with no incoming edges */
    roots(): Anode<NData>[] | null { return this.filterNodes(node => this.inDegree(node.id) === 0); }
    /** Nodes with no outgoing edges */
    leaves(): Anode<NData>[] | null { return this.filterNodes(node => this.outDegree(node.id) === 0); }

    /**
     * BFS: can `srcId` reach `dstId`?
     */
    hasPath(srcId: string, dstId: string): boolean {
        if (!this.nodes.has(srcId) || !this.nodes.has(dstId)) return false;
        if (srcId === dstId) return true;

        const visited = new Set<string>();
        const queue   = [srcId];
        let queueIndex = 0;

        while (queueIndex < queue.length) {
            const current = queue[queueIndex++];
            if (visited.has(current)) continue;
            visited.add(current);

            const outEdgeIds = this.outgoing.get(current);
            if (outEdgeIds) {
                for (const edgeId of outEdgeIds) {
                    const edge = this.edges.get(edgeId);
                    if (edge) {
                        if (edge.dstId === dstId) return true;
                        if (!visited.has(edge.dstId)) queue.push(edge.dstId);
                    }
                }
            }
        }

        return false;
    }

    /**
     * Topological order; cycles silently return null (or record to diag if available)
     */
    topoSort(): Anode<NData>[] | null {
        if (!this.#topoDirty && this.#topoCache !== null) {
            return this.#topoCache;
        }

        const inDegree = new Map<string, number>();
        for (const id of this.nodes.keys()) inDegree.set(id, 0);
        for (const edge of this.edges.values()) {
            inDegree.set(edge.dstId, (inDegree.get(edge.dstId) ?? 0) + 1);
        }

        const queue: string[] = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0) queue.push(id);
        }

        const sorted: Anode<NData>[] = [];
        let queueIndex = 0;
        while (queueIndex < queue.length) {
            const id = queue[queueIndex++];
            sorted.push(this.getNode(id)!);

            const outEdgeIds = this.outgoing.get(id);
            if (outEdgeIds) {
                for (const edgeId of outEdgeIds) {
                    const edge = this.edges.get(edgeId);
                    if (edge) {
                        const newDeg = inDegree.get(edge.dstId)! - 1;
                        inDegree.set(edge.dstId, newDeg);
                        if (newDeg === 0) queue.push(edge.dstId);
                    }
                }
            }
        }

        if (sorted.length !== this.nodes.size) {
            this.#topoCache = null;
            this.#topoDirty = false;
            this.diag?.err({
                code: "TOPO_SORT_FAILED",
                raw: 'Could not topologically sort graph "$label$": graph contains a cycle',
                data: { label: this.label }
            });
            return null;
        }

        this.#topoCache = sorted;
        this.#topoDirty = false;
        this.diag?.ok({ code: "TOPO_SORT_OK", data: { label: this.label } });
        return sorted;
    }

    /**
     * Groups nodes into topological layers (generations).
     * Nodes in the same layer have no dependencies between them and can run in parallel.
     * Returns null if the graph contains a cycle.
     */
    topoLayers(): Anode<NData>[][] | null {
        const inDegree = new Map<string, number>();
        for (const id of this.nodes.keys()) inDegree.set(id, 0);
        for (const edge of this.edges.values()) {
            inDegree.set(edge.dstId, (inDegree.get(edge.dstId) ?? 0) + 1);
        }

        const layers: Anode<NData>[][] = [];
        let currentLayerIds: string[] = [];
        for (const [id, deg] of inDegree) {
            if (deg === 0) currentLayerIds.push(id);
        }

        let totalVisited = 0;
        while (currentLayerIds.length > 0) {
            layers.push(currentLayerIds.map(id => this.getNode(id)!));
            totalVisited += currentLayerIds.length;

            const nextLayerIds: string[] = [];
            for (const id of currentLayerIds) {
                const outEdgeIds = this.outgoing.get(id);
                if (outEdgeIds) {
                    for (const edgeId of outEdgeIds) {
                        const edge = this.edges.get(edgeId);
                        if (edge) {
                            const newDeg = inDegree.get(edge.dstId)! - 1;
                            inDegree.set(edge.dstId, newDeg);
                            if (newDeg === 0) nextLayerIds.push(edge.dstId);
                        }
                    }
                }
            }
            currentLayerIds = nextLayerIds;
        }

        if (totalVisited !== this.nodes.size) {
            this.diag?.err({
                code: "TOPO_LAYERS_FAILED",
                raw: 'Could not compute topological layers for graph "$label$": graph contains a cycle',
                data: { label: this.label }
            });
            return null;
        }

        this.diag?.ok({ code: "TOPO_LAYERS_OK", data: { label: this.label, layerCount: layers.length } });
        return layers;
    }

    // ── Subgraph / clone / merge ───────────────────────────────────

    subgraph(nodeIds: string[]): Agraph | null {
        try {
            const idSet = new Set(nodeIds);
            const sub   = new Agraph({ label: `${this.label}_sub`, diag: this.diag });

            for (const id of idSet) {
                const node = this.getNode(id);
                if (!node) {
                    this.diag?.err({
                        code: "SUBGRAPH_FAILED",
                        raw: 'Could not create subgraph: node "$id$" does not exist',
                        data: { id, nodeIds }
                    });
                    return null;
                }
                sub.addNode({ id: node.id, data: _safeClone(node.data) });
            }

            for (const edge of this.edges.values()) {
                if (idSet.has(edge.srcId) && idSet.has(edge.dstId)) {
                    sub.addEdge(edge.srcId, edge.dstId, {
                        id:   edge.id,
                        data: _safeClone(edge.data)
                    });
                }
            }

            this.diag?.ok({ code: "SUBGRAPH_OK", data: { nodeIds } });
            return sub;
        } catch (error) {
            this.diag?.err({
                code: "SUBGRAPH_FAILED",
                raw: 'Could not create subgraph: $error$',
                data: { nodeIds, error }
            });
            return null;
        }
    }

    /**
     * Deep clone via `structuredClone` (with safe fallback for non-cloneable objects)
     */
    clone(): Agraph | null {
        try {
            const g = new Agraph({ label: this.label, diag: this.diag });
            g._nextNodeId = this._nextNodeId;
            g._nextEdgeId = this._nextEdgeId;

            for (const node of this.nodes.values()) {
                g.addNode({ id: node.id, data: _safeClone(node.data) });
            }

            for (const edge of this.edges.values()) {
                g.addEdge(edge.srcId, edge.dstId, {
                    id:   edge.id,
                    data: _safeClone(edge.data)
                });
            }

            this.diag?.ok({ code: "CLONE_OK", data: { label: this.label } });
            return g;
        } catch (error) {
            this.diag?.err({
                code: "CLONE_FAILED",
                raw: 'Could not clone graph "$label$": $error$',
                data: { label: this.label, error }
            });
            return null;
        }
    }

    /**
     * Merge in; skip dupes
     */
    mergeFrom(otherGraph: Agraph): this | null {
        try {
            for (const node of otherGraph.nodes.values()) {
                if (!this.nodes.has(node.id)) {
                    this.addNode({ id: node.id, data: _safeClone(node.data) });
                }
            }

            for (const edge of otherGraph.edges.values()) {
                if (!this.edges.has(edge.id)) {
                    this.addEdge(edge.srcId, edge.dstId, {
                        id:   edge.id,
                        data: _safeClone(edge.data)
                    });
                }
            }

            this.diag?.ok({ code: "MERGE_FROM_OK", data: { label: this.label, otherLabel: otherGraph?.label } });
            return this;
        } catch (error) {
            this.diag?.err({
                code: "MERGE_FROM_FAILED",
                raw: 'Could not merge graph "$otherLabel$" into "$label$": $error$',
                data: { label: this.label, otherLabel: otherGraph?.label, error }
            });
            return null;
        }
    }

    // ── Serialization ──────────────────────────────────────────────

    /**
     * JSON; only node/edge data survives
     */
    serialize({ nodeSerializer, edgeSerializer, replacer, space }: SerializeOptions<NData, EData> = {}): string | null {
        try {
            const json = JSON.stringify({
                label:        this.label,
                _nextNodeId:  this._nextNodeId,
                _nextEdgeId:  this._nextEdgeId,
                nodes: [...this.nodes.values()].map(n => ({ id: n.id, data: nodeSerializer ? nodeSerializer(n.data) : n.data })),
                edges: [...this.edges.values()].map(e => ({ id: e.id, srcId: e.srcId, dstId: e.dstId, data: edgeSerializer ? edgeSerializer(e.data) : e.data })),
            }, replacer, space);
            this.diag?.ok({ code: "SERIALIZE_OK", data: { label: this.label } });
            return json;
        } catch (error) {
            this.diag?.err({
                code: "SERIALIZE_FAILED",
                raw: 'Could not serialize graph "$label$": $error$',
                data: { label: this.label, error }
            });
            return null;
        }
    }

    static deserialize<NData = any, EData = any>(json: string, { diag, nodeDeserializer, edgeDeserializer, reviver }: DeserializeOptions<NData, EData> = {}): Agraph<NData, EData> | null {
        try {
            const raw = JSON.parse(json, reviver);
            const g   = new Agraph<NData, EData>({ label: raw.label, diag });
            g._nextNodeId = raw._nextNodeId;
            g._nextEdgeId = raw._nextEdgeId;

            for (const node of raw.nodes) {
                const data = nodeDeserializer ? nodeDeserializer(node.data) : node.data;
                g.addNode({ id: node.id, data });
            }
            for (const edge of raw.edges) {
                const data = edgeDeserializer ? edgeDeserializer(edge.data) : edge.data;
                g.addEdge(edge.srcId, edge.dstId, { id: edge.id, data });
            }

            diag?.ok({ code: "DESERIALIZE_OK" });
            return g;
        } catch (error) {
            diag?.err({
                code: "DESERIALIZE_FAILED",
                raw: "Could not deserialize graph JSON: $error$",
                data: { error }
            });
            return null;
        }
    }

    // ── Reset ──────────────────────────────────────────────────────

    clear({ resetIds = true }: ClearOptions = {}): this {
        this.nodes.clear();
        this.edges.clear();
        this.outgoing.clear();
        this.incoming.clear();

        this.#topoDirty = true;
        this.#topoCache = null;

        if (resetIds) {
            this._nextNodeId = 0;
            this._nextEdgeId = 0;
        }

        return this;
    }

    // ── Private helpers ────────────────────────────────────────────

    #edgesFromIds(ids: Iterable<string> | undefined): Aedge<EData>[] {
        if (!ids) return [];

        const result: Aedge<EData>[] = [];
        for (const id of ids) {
            const edge = this.edges.get(id);
            if (edge) result.push(edge);
        }

        return result;
    }
}

// ==================== Directed acyclic graph rules =====================

export class Adag {
    static addEdge<NData, EData>(graph: Agraph<NData, EData>, srcId: string, dstId: string, options: AddEdgeOptions<EData> = {}): Aedge<EData> | null {
        const canAdd = Adag.assertCanAddEdge(graph, srcId, dstId);
        if (canAdd === null) return null;
        return graph.addEdge(srcId, dstId, options);
    }

    static assertCanAddEdge(graph: Agraph<any, any>, srcId: string, dstId: string): true | null {
        if (!(graph instanceof Agraph)) {
            return null;
        }

        if (srcId == null) {
            graph.diag?.err({
                code: "DAG_ADD_EDGE_FAILED",
                raw: "Adag.addEdge: srcId is required",
                data: { srcId, dstId }
            });
            return null;
        }
        if (dstId == null) {
            graph.diag?.err({
                code: "DAG_ADD_EDGE_FAILED",
                raw: "Adag.addEdge: dstId is required",
                data: { srcId, dstId }
            });
            return null;
        }

        if (!graph.hasNode(srcId)) {
            graph.diag?.err({
                code: "DAG_ADD_EDGE_FAILED",
                raw: 'Adag.addEdge: source node "$srcId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }
        if (!graph.hasNode(dstId)) {
            graph.diag?.err({
                code: "DAG_ADD_EDGE_FAILED",
                raw: 'Adag.addEdge: destination node "$dstId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }

        if (_agraphWouldCreateCycle(graph, srcId, dstId)) {
            graph.diag?.err({
                code: "DAG_ADD_EDGE_FAILED",
                raw: 'Could not add DAG edge "$srcId$" -> "$dstId$": would create a cycle',
                data: { srcId, dstId }
            });
            return null;
        }

        return true;
    }

    static wouldCreateCycle(graph: Agraph<any, any>, srcId: string, dstId: string): boolean {
        if (!(graph instanceof Agraph)) {
            return false;
        }
        if (srcId == null || dstId == null) {
            graph.diag?.err({
                code: "WOULD_CREATE_CYCLE_FAILED",
                raw: "Adag.wouldCreateCycle: srcId and dstId are required",
                data: { srcId, dstId }
            });
            return false;
        }

        return _agraphWouldCreateCycle(graph, srcId, dstId);
    }

    static hasCycle(graph: Agraph<any, any>): boolean {
        if (!(graph instanceof Agraph)) {
            return false;
        }
        return graph.topoSort() === null;
    }

    static assertDag(graph: Agraph<any, any>): true | null {
        if (!(graph instanceof Agraph)) {
            return null;
        }

        const sorted = graph.topoSort();
        if (sorted === null) return null;

        graph.diag?.ok({ code: "DAG_ASSERT_OK", data: { label: graph.label } });
        return true;
    }
}

// ==================== Tree / forest rules over Agraph =====================

export interface AddTreeNodeOptions<NData = any, EData = any> {
    parentId?: string | null;
    data?: NData;
    edgeData?: EData;
    id?: string | null;
    edgeId?: string | null;
}

export interface AddTreeNodeResult<NData = any, EData = any> {
    node: Anode<NData>;
    edge: Aedge<EData> | null;
}

export interface AssertCanAddNodeOptions {
    parentId?: string | null;
    id?: string | null;
    edgeId?: string | null;
}

export interface AssertTreeOptions {
    allowForest?: boolean;
}

export class Atree {
    /**
     * Add a tree node and optionally attach it to a parent with an edge
     */
    static addNode<NData, EData>(graph: Agraph<NData, EData>, {
        parentId = null,
        data = {} as NData,
        edgeData = {} as EData,
        id = null,
        edgeId = null,
    }: AddTreeNodeOptions<NData, EData> = {}): AddTreeNodeResult<NData, EData> | null {
        const canAdd = Atree.assertCanAddNode(graph, { parentId, id, edgeId });
        if (canAdd === null) return null;

        const node = graph.addNode({ id, data })!;
        let edge: Aedge<EData> | null = null;

        try {
            if (parentId != null) {
                edge = Adag.addEdge(graph, parentId, node.id, {
                    id: edgeId,
                    data: edgeData,
                });
                if (!edge) {
                    graph.popNode(node.id);
                    return null;
                }
            }
        } catch (error) {
            graph.popNode(node.id);
            graph.diag?.err({
                code: "TREE_ADD_NODE_FAILED",
                raw: 'Could not add tree node "$id$" under parent "$parentId$": $error$',
                data: { id, parentId, error }
            });
            return null;
        }

        graph.diag?.ok({ code: "TREE_ADD_NODE_OK", data: { id: node.id, parentId } });
        return { node, edge };
    }

    /**
     * Add a parent -> child edge
     */
    static addEdge<NData, EData>(graph: Agraph<NData, EData>, srcId: string, dstId: string, options: AddEdgeOptions<EData> = {}): Aedge<EData> | null {
        const canAdd = Atree.assertCanAddEdge(graph, srcId, dstId);
        if (canAdd === null) return null;
        return graph.addEdge(srcId, dstId, options);
    }

    static assertCanAddNode(graph: Agraph<any, any>, { parentId = null, id = null, edgeId = null }: AssertCanAddNodeOptions = {}): true | null {
        if (!(graph instanceof Agraph)) {
            return null;
        }

        if (id != null && graph.hasNode(id)) {
            graph.diag?.err({
                code: "TREE_ADD_NODE_FAILED",
                raw: 'Atree.addNode: node "$id$" already exists',
                data: { id, parentId }
            });
            return null;
        }
        if (edgeId != null && graph.hasEdge(edgeId)) {
            graph.diag?.err({
                code: "TREE_ADD_NODE_FAILED",
                raw: 'Atree.addNode: edge "$edgeId$" already exists',
                data: { id, edgeId, parentId }
            });
            return null;
        }
        if (parentId != null && !graph.hasNode(parentId)) {
            graph.diag?.err({
                code: "TREE_ADD_NODE_FAILED",
                raw: 'Atree.addNode: parent node "$parentId$" does not exist',
                data: { id, parentId }
            });
            return null;
        }

        return true;
    }

    static assertCanAddEdge(graph: Agraph<any, any>, srcId: string, dstId: string): true | null {
        if (!(graph instanceof Agraph)) {
            return null;
        }

        if (srcId == null) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: "Atree.addEdge: srcId is required",
                data: { srcId, dstId }
            });
            return null;
        }
        if (dstId == null) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: "Atree.addEdge: dstId is required",
                data: { srcId, dstId }
            });
            return null;
        }

        if (!graph.hasNode(srcId)) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: 'Atree.addEdge: source node "$srcId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }
        if (!graph.hasNode(dstId)) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: 'Atree.addEdge: destination node "$dstId$" does not exist',
                data: { srcId, dstId }
            });
            return null;
        }

        if (srcId === dstId) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: 'Atree.addEdge: node "$srcId$" cannot be its own parent',
                data: { srcId, dstId }
            });
            return null;
        }
        if (graph.inDegree(dstId) > 0) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: 'Atree.addEdge: child node "$dstId$" already has a parent',
                data: { srcId, dstId }
            });
            return null;
        }

        if (_agraphWouldCreateCycle(graph, srcId, dstId)) {
            graph.diag?.err({
                code: "TREE_ADD_EDGE_FAILED",
                raw: 'Atree.addEdge: edge "$srcId$" -> "$dstId$" would create a cycle',
                data: { srcId, dstId }
            });
            return null;
        }

        return true;
    }

    static parentEdgeOf<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Aedge<EData> | null {
        if (!graph.hasNode(nodeId)) return null;

        const parentEdges = graph.inEdges(nodeId);
        if (parentEdges.length > 1) {
            graph.diag?.err({
                code: "PARENT_EDGE_FAILED",
                raw: 'Atree.parentEdgeOf: node "$nodeId$" has multiple parent edges',
                data: { nodeId }
            });
            return null;
        }

        return parentEdges[0] ?? null;
    }

    static parentOf<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Anode<NData> | null {
        const edge = Atree.parentEdgeOf(graph, nodeId);
        return edge ? graph.getNode(edge.srcId) : null;
    }

    static childEdgesOf<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Aedge<EData>[] {
        if (!graph.hasNode(nodeId)) return [];
        return graph.outEdges(nodeId);
    }

    static childrenOf<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Anode<NData>[] {
        return Atree.childEdgesOf(graph, nodeId)
            .map(edge => graph.getNode(edge.dstId))
            .filter((n): n is Anode => n !== null);
    }

    /**
     * Validate the graph as a tree or forest
     */
    static assertTree(graph: Agraph<any, any>, { allowForest = true }: AssertTreeOptions = {}): true | null {
        if (!(graph instanceof Agraph)) {
            return null;
        }

        const dagOk = Adag.assertDag(graph);
        if (dagOk === null) return null;

        for (const node of graph.getNodes()) {
            if (graph.inDegree(node.id) > 1) {
                graph.diag?.err({
                    code: "TREE_ASSERT_FAILED",
                    raw: 'Graph "$label$" is not a tree: node "$nodeId$" has multiple parents',
                    data: { label: graph.label, nodeId: node.id }
                });
                return null;
            }
        }

        if (!allowForest) {
            const roots = graph.roots();
            if (!roots || roots.length !== 1) {
                graph.diag?.err({
                    code: "TREE_ASSERT_FAILED",
                    raw: 'Graph "$label$" is not a tree: expected exactly one root, got $rootCount$',
                    data: { label: graph.label, rootCount: roots?.length ?? 0 }
                });
                return null;
            }
        }

        graph.diag?.ok({ code: "TREE_ASSERT_OK", data: { label: graph.label } });
        return true;
    }

    /** Returns all ancestor nodes from immediate parent to root. */
    static ancestors<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Anode<NData>[] {
        const result: Anode<NData>[] = [];
        let current = graph.getNode(nodeId);
        while (current) {
            const parent = Atree.parentOf(graph, current.id);
            if (!parent) break;
            result.push(parent);
            current = parent;
        }
        return result;
    }

    /** Returns all descendant nodes in BFS order. */
    static descendants<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Anode<NData>[] {
        const result: Anode<NData>[] = [];
        const queue: string[] = [nodeId];
        let qi = 0;
        while (qi < queue.length) {
            const id = queue[qi++];
            const children = Atree.childrenOf(graph, id);
            for (const child of children) {
                result.push(child);
                queue.push(child.id);
            }
        }
        return result;
    }

    /** Returns the depth of a node (root = 0). */
    static depth<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): number {
        let depth = 0;
        let current = graph.getNode(nodeId);
        while (current) {
            const parent = Atree.parentOf(graph, current.id);
            if (!parent) break;
            depth++;
            current = parent;
        }
        return depth;
    }

    /** Returns the height of the subtree rooted at nodeId (leaf = 0). */
    static height<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): number {
        const children = Atree.childrenOf(graph, nodeId);
        if (children.length === 0) return 0;
        return 1 + Math.max(...children.map(c => Atree.height(graph, c.id)));
    }

    /** True if the node has no incoming edges (is a tree root). */
    static isRoot<NData>(graph: Agraph<NData, any>, nodeId: string): boolean {
        return graph.inDegree(nodeId) === 0;
    }

    /** True if the node has no outgoing edges (is a leaf). */
    static isLeaf<NData>(graph: Agraph<NData, any>, nodeId: string): boolean {
        return graph.outDegree(nodeId) === 0;
    }

    /** Returns all siblings (children of the same parent, excluding nodeId itself). */
    static siblings<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Anode<NData>[] {
        const parent = Atree.parentOf(graph, nodeId);
        if (!parent) return [];
        return Atree.childrenOf(graph, parent.id).filter(n => n.id !== nodeId);
    }

    /**
     * Lowest Common Ancestor of two nodes.
     * Returns null if no common ancestor exists across disconnected trees.
     */
    static lca<NData, EData>(graph: Agraph<NData, EData>, nodeId1: string, nodeId2: string): Anode<NData> | null {
        const ancestors1 = new Set<string>([nodeId1]);
        let cur: Anode<NData> | null = graph.getNode(nodeId1);
        while (cur) {
            const p: Anode<NData> | null = Atree.parentOf(graph, cur.id);
            if (!p) break;
            ancestors1.add(p.id);
            cur = p;
        }

        cur = graph.getNode(nodeId2);
        if (!cur) return null;
        if (ancestors1.has(cur.id)) return cur;
        while (cur) {
            const p: Anode<NData> | null = Atree.parentOf(graph, cur.id);
            if (!p) break;
            if (ancestors1.has(p.id)) return p;
            cur = p;
        }
        return null;
    }

    /**
     * Moves a node to a new parent by replacing its parent edge
     * .
     * Validates that newParentId is not a descendant of nodeId (which would create a cycle).
     * Returns the new parent edge, or null on failure.
     */
    static move<NData, EData>(
        graph: Agraph<NData, EData>,
        nodeId: string,
        newParentId: string,
        options: AddEdgeOptions<EData> = {}
    ): Aedge<EData> | null {
        if (!graph.hasNode(nodeId)) {
            graph.diag?.err({ code: "TREE_MOVE_FAILED", raw: 'Atree.move: node "$nodeId$" does not exist', data: { nodeId, newParentId } });
            return null;
        }
        if (!graph.hasNode(newParentId)) {
            graph.diag?.err({ code: "TREE_MOVE_FAILED", raw: 'Atree.move: new parent "$newParentId$" does not exist', data: { nodeId, newParentId } });
            return null;
        }
        if (nodeId === newParentId) {
            graph.diag?.err({ code: "TREE_MOVE_FAILED", raw: 'Atree.move: node "$nodeId$" cannot be its own parent', data: { nodeId, newParentId } });
            return null;
        }
        if (_agraphWouldCreateCycle(graph, newParentId, nodeId)) {
            graph.diag?.err({ code: "TREE_MOVE_FAILED", raw: 'Atree.move: "$newParentId$" is a descendant of "$nodeId$", cannot reparent', data: { nodeId, newParentId } });
            return null;
        }
        const oldEdge = Atree.parentEdgeOf(graph, nodeId);
        if (oldEdge) graph.popEdge(oldEdge.id);
        const newEdge = graph.addEdge(newParentId, nodeId, options);
        if (!newEdge) {
            graph.diag?.err({ code: "TREE_MOVE_FAILED", raw: 'Atree.move: failed to add new parent edge', data: { nodeId, newParentId } });
            return null;
        }
        graph.diag?.ok({ code: "TREE_MOVE_OK", data: { nodeId, newParentId } });
        return newEdge;
    }

    /**
     * Extracts the subtree rooted at nodeId as a new Agraph.
     * Includes nodeId and all descendants, plus all their interconnecting edges.
     */
    static subtree<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Agraph<NData, EData> | null {
        if (!graph.hasNode(nodeId)) {
            graph.diag?.err({ code: "TREE_SUBTREE_FAILED", raw: 'Atree.subtree: node "$nodeId$" does not exist', data: { nodeId } });
            return null;
        }
        const desc = Atree.descendants(graph, nodeId);
        const nodeIds = [nodeId, ...desc.map(n => n.id)];
        return graph.subgraph(nodeIds);
    }

    /**
     * Pre-order DFS traversal: visits a node before its children (top-down).
     */
    static preOrder<NData>(graph: Agraph<NData, any>, nodeId: string, fn: (node: Anode<NData>) => void): void {
        const node = graph.getNode(nodeId);
        if (!node) return;
        fn(node);
        for (const child of Atree.childrenOf(graph, nodeId)) {
            Atree.preOrder(graph, child.id, fn);
        }
    }

    /**
     * Post-order DFS traversal: visits a node after all its children (bottom-up).
     */
    static postOrder<NData>(graph: Agraph<NData, any>, nodeId: string, fn: (node: Anode<NData>) => void): void {
        for (const child of Atree.childrenOf(graph, nodeId)) {
            Atree.postOrder(graph, child.id, fn);
        }
        const node = graph.getNode(nodeId);
        if (node) fn(node);
    }
}

// ==================== Private helpers =====================

function uniqueById(): (node: Anode<any>) => boolean {
    const seen = new Set<string>();
    return node => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
    };
}

function _agraphWouldCreateCycle(graph: Agraph<any, any>, srcId: string, dstId: string): boolean {
    if (srcId === dstId) return true;
    return graph.hasPath(dstId, srcId);
}
