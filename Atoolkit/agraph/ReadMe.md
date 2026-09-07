# Agraph

Directed graph data structure. Stores graph topology only; execution and traversal are handled separately.

---

## Core Characteristics

1. **Topology Only**: Pure node, directed edge, and adjacency management decoupled from execution or scheduling.
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

### Nodes

| Method | Signature | Description |
| :--- | :--- | :--- |
| `addNode` | `addNode(options?): Anode<NData> \| null` | Creates and inserts a node. Returns null if ID exists. |
| `getNode` | `getNode(id: string): Anode<NData> \| null` | Returns node by ID or null. |
| `hasNode` | `hasNode(id: string): boolean` | Returns true if node exists. |
| `popNode` | `popNode(id: string): Anode<NData> \| null` | Removes node, removes incident edges, and returns the node. |
| `removeNode` | `removeNode(id: string): Anode<NData> \| null` | Alias for `popNode`. |
| `getNodes` | `getNodes(): Anode<NData>[]` | Returns array snapshot of all nodes. |
| `nodeCount` | `get nodeCount(): number` | Number of nodes in graph. |

### Edges

| Method | Signature | Description |
| :--- | :--- | :--- |
| `addEdge` | `addEdge(srcId, dstId, options?): Aedge<EData> \| null` | Adds directed edge `srcId -> dstId`. |
| `getEdge` | `getEdge(id: string): Aedge<EData> \| null` | Looks up edge by ID. |
| `hasEdge` | `hasEdge(id: string): boolean` | Returns true if edge exists. |
| `popEdge` | `popEdge(id: string): Aedge<EData> \| null` | Removes and returns edge. |
| `removeEdge` | `removeEdge(id: string): Aedge<EData> \| null` | Alias for `popEdge`. |
| `getEdges` | `getEdges(): Aedge<EData>[]` | Returns array snapshot of all edges. |
| `edgeCount` | `get edgeCount(): number` | Number of edges in graph. |
| `edgesOf` | `edgesOf(nodeId, { direction }): Aedge<EData>[]` | Edges touching `nodeId` ("out", "in", or "both"). |
| `outEdges` | `outEdges(nodeId): Aedge<EData>[]` | Outgoing edges from `nodeId`. |
| `inEdges` | `inEdges(nodeId): Aedge<EData>[]` | Incoming edges to `nodeId`. |
| `edgesBetween` | `edgesBetween(srcId, dstId): Aedge<EData>[]` | Directed edges from `srcId` to `dstId`. |
| `edgesConnecting` | `edgesConnecting(id1, id2): Aedge<EData>[]` | Edges between `id1` and `id2` across both directions. |
| `sortOutgoingEdges` | `sortOutgoingEdges(nodeId, sortFn): Aedge<EData>[]` | Sorts outgoing edges in place and returns them. |
| `sortIncomingEdges` | `sortIncomingEdges(nodeId, sortFn): Aedge<EData>[]` | Sorts incoming edges in place and returns them. |

### Traversal and Topology Queries

- `connectionsOf(nodeId, { direction })`: Returns `{ from, to, edge, dir }` connection records.
- `neighborsOf(nodeId, { direction })`: Returns unique neighbor nodes without intermediate connection objects.
- `successors(nodeId)`: Nodes reachable via outgoing edges.
- `predecessors(nodeId)`: Nodes pointing to `nodeId`.
- `degree(nodeId)` / `outDegree` / `inDegree`: Edge count queries with zero array allocations.
- `roots()`: Nodes with in-degree 0.
- `leaves()`: Nodes with out-degree 0.
- `hasPath(srcId, dstId)`: BFS reachability check.
- `topoSort()`: Kahn's topological sort with dirty-flag caching. Returns `Anode[]` or null if cyclic.
- `topoLayers()`: Partitions nodes into dependency generations (`Anode[][]`). Nodes in the same generation run independently in parallel.

### Graph Lifecycle and Cloning

- `clear({ resetIds = true })`: Empties nodes and edges.
- `subgraph(nodeIds)`: Extracts isolated subgraph containing specified nodes and shared edges.
- `clone()`: Deep-clones graph structure and data payloads.
- `mergeFrom(otherGraph)`: Copies nodes and edges from another graph, ignoring ID collisions.
- `serialize(options)` / `Agraph.deserialize(json, options)`: JSON persistence.

---

## Subsystems

### `Adag` (Directed Acyclic Graph)
Prevents edge insertion when it would introduce a cycle:

```ts
Adag.addEdge(graph, "nodeA", "nodeB");
Adag.assertDag(graph); // returns true | null
```

#### Diamond Topologies
Diamond DAGs (where branches diverge from a parent and converge on a child) are valid acyclic graphs because no backward paths exist.

### `Atree` (Tree & Forest Invariants)
Enforces single-parent constraints and provides hierarchical queries:

```ts
// Attach child under parent
Atree.addNode(graph, { parentId: "rootNode", id: "childNode" });

// Queries
const parent   = Atree.parentOf(graph, "childNode");
const children = Atree.childrenOf(graph, "rootNode");
const siblings = Atree.siblings(graph, "childNode");
const depth    = Atree.depth(graph, "childNode");       // root = 0
const height   = Atree.height(graph, "rootNode");       // leaf = 0
const lca      = Atree.lca(graph, "nodeA", "nodeB");    // lowest common ancestor

// Reparenting and extraction
Atree.move(graph, "childNode", "newParentNode");
const subGraph = Atree.subtree(graph, "subRoot");

// Traversals
Atree.preOrder(graph, "rootNode", (node) => { /* top-down */ });
Atree.postOrder(graph, "rootNode", (node) => { /* bottom-up */ });

// Validation
Atree.assertTree(graph, { allowForest: false });
```
