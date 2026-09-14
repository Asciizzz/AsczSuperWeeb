# Acircuit

Directed value computation circuit featuring typed socket endpoints, 1-to-1 input connections, 1-to-N output fan-out, static graph validation, subcircuit composite encapsulation, and dependency plan caching.

---

## Architecture Overview

Acircuit structures computational graphs across five core primitives:

1. `Socket`: Input and output endpoint descriptors with optional data type and requirement tags.
2. `Wire`: Directed connection interface linking an output endpoint to an input endpoint.
3. `CircuitNode`: Stateless computational unit declaring socket interfaces and evaluating input records.
4. `Circuit`: Graph topology owner resolving dependencies, performing static analysis, and caching execution plans.
5. `Subcircuit`: Composite node encapsulating an inner circuit with boundary socket mapping and graph inlining support.

---

## 1. Socket and Wire Endpoints

`Socket` represents an endpoint on a computational node. `Wire` connects an output socket to an input socket.

```typescript
import { Socket, inSocketKey, wireEquals, type Wire } from "./index.js";

// Endpoint definition with data type and requirement tags
const inSocket = new Socket("intensity", "input", { dataType: "number", required: true });
const outSocket = new Socket("result", "output", "number");

// Wire interface
const wire: Wire = {
    outNodeId: "sourceNode",
    outSocket: "result",
    inNodeId: "targetNode",
    inSocket: "intensity",
};

// Endpoint lookup key
const key = inSocketKey("targetNode", "intensity"); // "targetNode:intensity"
```

- `Socket(name, direction, options)`: Instantiates endpoint. `direction` enforces `"input"` or `"output"`. Options configure `dataType` (for type compatibility enforcement) and `required` (for static validation).
- `Wire`: Immutable directed connection describing `{ outNodeId, outSocket, inNodeId, inSocket }`.
  - Input sockets enforce 1-to-1 wiring; connecting a new wire replaces any pre-existing connection.
  - Output sockets support 1-to-N fan-out to multiple downstream inputs.
- `inSocketKey(nodeId, socketName)` / `outSocketKey`: Generates colon-delimited lookup keys (`"nodeId:socketName"`).
- `wireEquals(a, b)`: Compares two wire instances across all four endpoint coordinates.
- `formatWire(wire)`: Formats connection string for diagnostic logging: `"(outNode:outSocket -> inNode:inSocket)"`.

---

## 2. Computational Nodes

`CircuitNode` represents a stateless processing unit with declared inputs and outputs. Values belong strictly to the circuit run, not to the node instance.

```typescript
import { CircuitNode, type ProcessCtx } from "./index.js";

class MultiplyAddNode extends CircuitNode {
    constructor(id: string) {
        super(id, "MultiplyAdd");
        this.addInput("a", "number")
            .addInput("b", "number")
            .addInput("c", "number")
            .addOutput("result", "number");
    }

    override canConnectInput(
        inSocketName: string,
        outNode: CircuitNode,
        outSocketName: string
    ): boolean {
        // Enforces socket existence and dataType matching
        return super.canConnectInput(inSocketName, outNode, outSocketName);
    }

    override process(
        inputs: Record<string, any>,
        ctx?: ProcessCtx
    ): Record<string, any> {
        const a = typeof inputs.a === "number" ? inputs.a : 0;
        const b = typeof inputs.b === "number" ? inputs.b : 0;
        const c = typeof inputs.c === "number" ? inputs.c : 0;
        return { result: (a * b) + c };
    }
}
```

- `CircuitNode(id, name)`: Abstract base constructor registering immutable string identifier and debug name.
- `addInput(socketOrName, options)` / `addOutput(socketOrName, dataType)`: Registers endpoints with optional type validation tags.
- `canConnectInput(inSocketName, outNode, outSocketName)`: Pre-connection validation gate invoked by `Circuit.connect()`. Verifies type compatibility when data types are declared.
- `process(inputs, ctx)`: Evaluates node using resolved input values for the current pass.
- `NodeProxy`: Transparent proxy node delegating execution and configuration to a wrapped source node.

---

## 3. Circuit Topology and Static Validation

`Circuit` manages node collections, maintains multi-map wire indices, validates acyclic constraints, and caches execution plans.

```typescript
import { Circuit } from "./index.js";

const circuit = new Circuit({ label: "AudioSignalPipeline" });

const nodeA = new MultiplyAddNode("nodeA");
const nodeB = new MultiplyAddNode("nodeB");

// Graph construction
circuit.addNode(nodeA);
circuit.addNode(nodeB);

// Wire connection (replaces existing connection on nodeB:a)
const wire = circuit.connect(nodeA, "result", nodeB, "a");

// Static validation without throwing
const validation = circuit.validate();
if (!validation.valid) {
    console.error("Circuit issues:", validation.issues);
}
```

- Storage structures:
  - `nodes: Map<string, CircuitNode>`: Registered nodes by identifier.
  - `_inWires: Map<string, Wire>`: 1-to-1 map keyed by `"inNodeId:inSocket"`.
  - `_outWires: Map<string, Wire[]>`: 1-to-N map keyed by `"outNodeId:outSocket"`.
  - `_nodeInWires` / `_nodeOutWires`: Grouped wire indices by node ID for fast bulk disconnection.
- `connect(outNode, outSocket, inNode, inSocket)`: Validates endpoints, enforces `canConnectInput`, replaces pre-existing wire on destination input, and invalidates cached plan.
- `disconnect(wireOrNodeId, inSocketName?)`: Removes matching wire from indices and invalidates plan.
- `disconnectAll(nodeOrId)`: Removes all connections associated with node.
- `validate()`: Statically analyzes graph and returns `{ valid: boolean, issues: CircuitIssue[] }`. Detects:
  - Cycles (`"cycle"`)
  - Missing required inputs (`"missing_input"`)
  - Mismatched socket data types (`"type_mismatch"`)
  - Isolated disconnected nodes (`"isolated_node"`)

---

## 4. Graph Inspection and Traversal

`Circuit` provides non-destructive graph analysis queries:

- `getSources()`: Returns array of nodes with indegree 0 (zero incoming wires).
- `getSinks()`: Returns array of nodes with outdegree 0 (zero outgoing wires).
- `getUpstreamNodes(nodeOrId)`: Returns a `Set<CircuitNode>` containing all transitive ancestor dependencies feeding into the specified node.
- `getDownstreamNodes(nodeOrId)`: Returns a `Set<CircuitNode>` containing all transitive descendant nodes fed by the specified node.
- `isReachable(fromNode, toNode)`: Returns boolean indicating whether a directed path exists from source to target.

---

## 5. Dead Code Elimination and Subgraphs

`Circuit` supports pruning unused nodes and extracting isolated sub-graphs:

```typescript
// Prunes all nodes that do not contribute to target sinks
circuit.pruneUnreachable(["outputNode"]);

// Extracts minimal subgraph required to compute target nodes
const subCircuit = circuit.extractSubgraph(["outputNode"]);
```

- `pruneUnreachable(targetNodeIds?)`: Keeps target nodes (or all sinks if omitted) and their transitive upstream dependencies; removes all non-contributing nodes and wires from the circuit.
- `extractSubgraph(targetNodeIds, options?)`: Constructs and returns a new `Circuit` containing only target nodes, their transitive upstream dependencies, and interconnecting wires.

---

## 6. Composite Subcircuits and Inlining

`Subcircuit` wraps an entire inner circuit as a single computational node, mapping outer boundary sockets to inner nodes.

```typescript
import { Circuit, Subcircuit } from "./index.js";

const inner = new Circuit({ label: "FilterBlock" });
// ... populate inner circuit ...

const composite = new Subcircuit("filter1", "AudioFilter", inner);
composite.mapInput("audioIn", "innerPreAmp", "signal");
composite.mapOutput("audioOut", "innerPostAmp", "result");

const mainCircuit = new Circuit({ label: "Main" });
mainCircuit.addNode(composite);

// Inline/flatten composite into parent circuit
mainCircuit.flatten("filter1");
```

- `mapInput(outerSocket, innerNodeId, innerSocket, dataType?)`: Maps external input to internal node input.
- `mapOutput(outerSocket, innerNodeId, innerSocket, dataType?)`: Maps internal node output to external output.
- `flatten(nodeOrId, prefix?)`: Inlines inner nodes into parent circuit with prefixed IDs, re-routes incoming and outgoing wires directly to inner endpoints, copies inner wires, and removes composite node.

---

## 7. Serialization, Cloning, and Merging

- `toJSON()`: Serializes topology, sockets, and metadata into a portable `SerializedCircuit` structure.
- `Circuit.fromJSON(json, nodeFactory)`: Reconstructs circuit graph using a factory callback instantiating nodes by descriptor.
- `clone(nodeCloner?)`: Duplicates circuit and interconnecting wires.
- `merge(other, prefix?)`: Merges another circuit into this graph with optional ID prefixing.

---

## 8. Topological Execution Pipeline

`circuit.run()` evaluates nodes in dependency order using run-local input and output records.

```typescript
import { Circuit, type RunOptions, type RunResult } from "./index.js";

const result = circuit.run({
    overrides: {
        nodeA: { a: 2, b: 3, c: 4 },
        nodeB: { b: 10, c: 5 },
    },
    ctx: { sampleRate: 44100 },
    onNodeEnter: (node, inputs) => console.log(`Executing ${node.id}`),
    onNodeLeave: (node, outputs) => console.log(`Completed ${node.id}`, outputs),
    onWireTransmit: (wire, value) => console.log(`Wire transmitted:`, wire, value),
});

const finalOutput = result.outputs.get("nodeB")?.result;
console.log(result.executedNodes);
console.log(result.errors);
```