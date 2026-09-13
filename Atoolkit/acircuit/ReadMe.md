# Acircuit

Directed value computation circuit featuring typed socket endpoints, 1-to-1 input connections, 1-to-N output fan-out, Kahn topological sorting, and dependency plan caching.

---

## Architecture Overview

Acircuit structures computational graphs across four core primitives:

1. `Asocket`: Input and output endpoint descriptors.
2. `Awire`: Directed connection interface linking an output endpoint to an input endpoint.
3. `Acnode`: Stateless computational node declaring endpoints and evaluating input records.
4. `Acircuit`: Graph topology owner resolving dependencies, caching execution plans, and scheduling evaluation.

---

## 1. Socket and Wire Endpoints

`Asocket` represents an endpoint on a computational node. `Awire` connects an output socket to an input socket.

```typescript
import { Asocket, inSocketKey, wireEquals, type Awire } from "./index.js";

// Endpoint definition
const inSocket = new Asocket("intensity", "input");
const outSocket = new Asocket("result", "output");

// Wire interface
const wire: Awire = {
    outNodeId: "sourceNode",
    outSocket: "result",
    inNodeId: "targetNode",
    inSocket: "intensity",
};

// Endpoint lookup key
const key = inSocketKey("targetNode", "intensity"); // "targetNode:intensity"
```

- `Asocket(name, direction)`: Instantiates endpoint. `direction` enforces `"input"` or `"output"`. Sockets declare communication interfaces for nodes.
- `Awire`: Immutable directed connection describing `{ outNodeId, outSocket, inNodeId, inSocket }`.
  - Input sockets enforce 1-to-1 wiring; connecting a new wire replaces any pre-existing connection.
  - Output sockets support 1-to-N fan-out to multiple downstream inputs.
- `inSocketKey(nodeId, socketName)` / `outSocketKey`: Generates colon-delimited lookup keys (`"nodeId:socketName"`) for internal edge index maps.
- `wireEquals(a, b)`: Compares two wire instances across all four endpoint coordinates.
- `formatWire(wire)`: Formats connection string for diagnostic logging: `"(outNode:outSocket -> inNode:inSocket)"`.

---

## 2. Computational Nodes

`Acnode` represents a stateless processing unit with declared inputs and outputs. Values belong strictly to the circuit run, not to the node instance.

```typescript
import { Acnode, type ProcessCtx } from "./index.js";

class MultiplyAddNode extends Acnode {
    constructor(id: string) {
        super(id, "MultiplyAdd");
        this.addInput("a")
            .addInput("b")
            .addInput("c")
            .addOutput("result");
    }

    override canConnectInput(
        inSocketName: string,
        outNode: Acnode,
        outSocketName: string
    ): boolean {
        // Validation gate preventing invalid connections
        return true;
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

- `Acnode(id, name)`: Abstract base constructor registering immutable string identifier and debug name.
- `addInput(socketOrName)` / `addOutput(socketOrName)`: Registers endpoint. Throws if direction does not match method intent. Returns `this` for fluent chaining.
- `canConnectInput(inSocketName, outNode, outSocketName)`: Pre-connection validation gate invoked by `Acircuit.connect()`. Returning `false` causes the circuit to reject the connection with an error.
- `process(inputs, ctx)`: Evaluates node using resolved input values for the current execution pass. Returns record mapping output socket names to computed values. Nodes retain no run-specific state across invocations.

---

## 3. Circuit Topology and Dependency Caching

`Acircuit` manages node collections, maintains multi-map wire indices, validates acyclic constraints, and caches execution plans.

```typescript
import { Acircuit } from "./index.js";

const circuit = new Acircuit({ label: "AudioSignalPipeline" });

const nodeA = new MultiplyAddNode("nodeA");
const nodeB = new MultiplyAddNode("nodeB");

// Graph construction
circuit.addNode(nodeA);
circuit.addNode(nodeB);

// Wire connection (replaces existing connection on nodeB:a)
const wire = circuit.connect(nodeA, "result", nodeB, "a");

// Inspect wires
const incoming = circuit.getIncomingWire(nodeB, "a");
const outgoing = circuit.getOutgoingWires(nodeA, "result");

// Disconnect
circuit.disconnect(wire);
circuit.disconnect("nodeB", "a");
circuit.disconnectAll(nodeB);
```

- Storage structures:
  - `nodes: Map<string, Acnode>`: Registered nodes by identifier.
  - `_inWires: Map<string, Awire>`: 1-to-1 map keyed by `"inNodeId:inSocket"`.
  - `_outWires: Map<string, Awire[]>`: 1-to-N map keyed by `"outNodeId:outSocket"`.
  - `_nodeInWires` / `_nodeOutWires`: Grouped wire indices by node ID for fast bulk disconnection.
- `connect(outNode, outSocket, inNode, inSocket)`: Validates that endpoints exist, confirms `canConnectInput` returns true, automatically registers unregistered nodes, replaces any existing wire on the target input, updates indices, and marks topological cache dirty.
- `disconnect(wireOrNodeId, inSocketName?)`: Removes matching wire from both incoming and outgoing index maps, marking topological cache dirty.
- `disconnectAll(nodeOrId)`: Removes all incoming and outgoing connections associated with node.
- `topoSort(force?)`: Executes Kahn's algorithm by computing node indegrees. Detects cycles and throws error if graph is cyclic. Caches sorted order and pre-computed evaluation plan (`_cachedPlan`) until topology is modified.

---

## 4. Topological Execution Pipeline

`circuit.run()` evaluates nodes in dependency order using local input/output buffers.

```typescript
import { Acircuit, type RunOptions, type RunResult } from "./index.js";

const result = circuit.run({
    // Initial values for unconnected input sockets
    overrides: {
        nodeA: { a: 2, b: 3, c: 4 },
        nodeB: { b: 10, c: 5 },
    },
    // Optional execution context passed to node.process(inputs, ctx)
    ctx: { sampleRate: 44100 },
    // Telemetry callbacks
    onNodeEnter: (node, inputs) => console.log(`Executing ${node.id}`),
    onNodeLeave: (node, outputs) => console.log(`Completed ${node.id}`, outputs),
    onWireTransmit: (wire, value) => console.log(`Wire transmitted:`, wire, value),
});

// Output inspection
const finalOutput = result.outputs.get("nodeB")?.result; // (2*3+4)*10 + 5 = 105
console.log(result.executedNodes); // [nodeA, nodeB]
console.log(result.errors);        // Caught execution errors
```

- `run(options)`: Resolves topological plan. For every step:
  - Reads input socket values from upstream node outputs in the local run output map, falling back to `options.overrides` for unconnected sockets.
  - Fires `onWireTransmit` callback for resolved values.
  - Fires `onNodeEnter` callback.
  - Calls `node.process(inputs, ctx)`.
  - Catches execution errors, appending them to `result.errors` without halting subsequent independent nodes.
  - Records node output record in local run output map.
  - Fires `onNodeLeave` callback.
- `RunResult`: Contains `outputs: Map<string, Record<string, any>>`, `executedNodes: Acnode[]`, and `errors: Array<{ nodeId: string; error: unknown }>`.