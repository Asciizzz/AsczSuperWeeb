# Agraph

Directed graph data structure. Stores graph topology only; execution and traversal are handled separately.

---

## Core Characteristics

1. **Topology Only**: Pure node, directed edge, and adjacency management.
2. **Null Failure Returns**: Invalid operations return `null` instead of throwing unhandled exceptions.
3. **Diagnostic Telemetry (`Adiag`)**: Logs structured results (`ok`, `warn`, `err`) to optional `Adiag` instances.
4. **Extraction Semantics**: `popNode` and `popEdge` unlink incident edges and return removed elements.
5. **Invariant Constraints**: Provides `Adag` for acyclic enforcement and `Atree` for hierarchical single-parent constraints.
6. **Low-Allocation Queries**: Reads internal adjacency maps directly to minimize garbage collection during loops.

---

## Quick Start

```ts
import { Adiag } from "../adiag/index.js";
import { Agraph, Adag, Atree } from "../agraph/index.js";

const diag = new Adiag();
const graph = new Agraph<MyNodeData, MyEdgeData>({ label: "PipelineGraph", diag });

// 1. Add Nodes
const nodeA = graph.addNode({ id: "nodeA", data: { name: "Pass 1" } })!;
const nodeB = graph.addNode({ id: "nodeB", data: { name: "Pass 2" } })!;
const nodeC = graph.addNode({ id: "nodeC", data: { name: "Pass 3" } })!;

// 2. Add Directed Edges (nodeA -> nodeB -> nodeC)
const edge1 = graph.addEdge("nodeA", "nodeB", { data: { weight: 1.0 } })!;
const edge2 = graph.addEdge("nodeB", "nodeC", { data: { weight: 2.0 } })!;

// 3. Query topology
console.log(graph.hasPath("nodeA", "nodeC")); // true
console.log(graph.inDegree("nodeB"));          // 1
console.log(graph.outDegree("nodeB"));         // 1
console.log(graph.successors("nodeB"));        // [Anode { id: "nodeC" }]

// 4. Topological Sort
const sorted = graph.topoSort();               // [nodeA, nodeB, nodeC]

// 5. Pop / Extract
const popped = graph.popNode("nodeB");         // Removes nodeB and cuts edge1 and edge2
console.log(popped?.id);                       // "nodeB"
console.log(graph.hasEdge(edge1.id));          // false
```

---

## API

```ts
export class Agraph<NData = unknown, EData = unknown> {
    constructor(options?: AgraphOptions);

    addNode(options?: AddNodeOptions<NData>): Anode<NData> | null;
    popNode(id: string): Anode<NData> | null;
    addEdge(srcId: string, dstId: string, options?: AddEdgeOptions<EData>): Aedge<EData> | null;
    popEdge(id: string): Aedge<EData> | null;

    hasPath(srcId: string, dstId: string): boolean;
    topoSort(): Anode<NData>[] | null;
    topoLayers(): Anode<NData>[][] | null;
    subgraph(nodeIds: string[]): Agraph<NData, EData>;
}
```

* **`popNode(id)`**: Unlinks all incident incoming and outgoing edges before removing and returning the node.
* **`hasPath(srcId, dstId)`**: BFS reachability check determining whether a directed path exists from source to destination.
* **`topoSort()`**: Kahn topological sort with dirty-flag cache invalidation. Returns sorted array or null if cycles exist.
* **`topoLayers()`**: Partitions nodes into dependency generations (`Anode[][]`) where nodes in the same tier can execute concurrently.
* **`subgraph(nodeIds)`**: Extracts an isolated `Agraph` containing only the specified nodes and edges connecting them.

---

## Subsystems

### `Adag` (Directed Acyclic Graph)

```ts
export class Adag {
    static addEdge<NData, EData>(graph: Agraph<NData, EData>, srcId: string, dstId: string, options?: AddEdgeOptions<EData>): Aedge<EData> | null;
    static assertDag<NData, EData>(graph: Agraph<NData, EData>): boolean | null;
}
```

* **`addEdge(...)`**: Validates whether inserting the edge would create a cycle using backwards reachability, returning `null` on cycle violation.
* **`assertDag(...)`**: Validates the entire graph is acyclic via topological sort, returning `true` or `null`.

Diamond DAGs (where branches diverge from a parent and converge on a child) are valid acyclic graphs because no backward paths exist.

### `Atree` (Tree & Forest Invariants)

```ts
export class Atree {
    static addNode<NData>(graph: Agraph<NData, any>, options: TreeAddNodeOptions<NData>): Anode<NData> | null;
    static move<NData, EData>(graph: Agraph<NData, EData>, nodeId: string, newParentId: string): Aedge<EData> | null;
    static lca<NData, EData>(graph: Agraph<NData, EData>, nodeId1: string, nodeId2: string): Anode<NData> | null;
    static subtree<NData, EData>(graph: Agraph<NData, EData>, nodeId: string): Agraph<NData, EData> | null;
    static assertTree(graph: Agraph<any, any>, options?: AssertTreeOptions): boolean | null;
}
```

* **`move(...)`**: Reparents a node by replacing its incoming edge, verifying that the target parent is not a descendant to prevent cycle formation.
* **`lca(...)`**: Finds the lowest common ancestor node between two nodes, returning `null` if they reside in disconnected trees.
* **`assertTree(...)`**: Enforces single-parent tree or forest invariants.
