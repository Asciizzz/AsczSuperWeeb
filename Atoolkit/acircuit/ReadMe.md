# Atoolkit/acircuit

Standalone socket-based computation circuit with extensible sockets, lightweight wire indexing, and unified topological execution (`node.process(packets, ctx)`).

Not to be confused with A-circus of course (TADC and The Boys fighting for the worst ending in a show)

---

## Architecture

1. **`Asocket` Inheritance Base**:
   - Holds socket `name` and optional `metadata`.
   - Specialized socket types attach custom properties, validation rules, or payloads by subclassing `Asocket`.
2. **`Awire` Topology Edge**:
   - Directed connection `{ outNodeId, outSocket, inNodeId, inSocket, data?: TData }`.
   - Returns directly from `circuit.connect(...)` for immediate handle tracking and targeted disconnection via `circuit.disconnect(wire)`.
3. **`Packet` Transmission Model**:
   - Every input delivered to a node arrives as a `Packet`: `{ value, wire }`.
   - Eliminates parallel arrays and manual zipping.
   - For multi-wire fan-in (`allowMultipleInput === true`), receives `Packet[]`, enabling direct sorting via wire metadata (`a.wire.data.order - b.wire.data.order`).
4. **Causal Precedence**:
   - Topological sorting via Kahn's algorithm ensures producer nodes process before consumer nodes. Cycles are detected and rejected.

---

## Core API

### 1. Asocket

Base unit representing a named socket:

```typescript
export class Asocket {
    readonly name: string;
    metadata: Record<string, unknown>;

    constructor(name: string);
}
```

- **`metadata`**: Extensible dictionary for attached validation rules, data types, or configuration properties.

### 2. Awire & Packet

Directed connection and transmission container:

```typescript
export interface Awire<TData = any> {
    outNodeId: string;
    outSocket: string;
    inNodeId: string;
    inSocket: string;
    data?: TData;
}

export interface Packet<T = any, TData = any> {
    value: T;
    wire?: Awire<TData>;
}
```

- **`data`**: Optional typed payload attached to the connection, accessible by input nodes during execution.
- **`Packet`**: Delivery container pairing transmission value with originating `Awire`. Sockets configured for multiple inputs receive `Packet[]`, preserving wire metadata for sorting.

### 3. Acnode

Base abstract unit of computation:

```typescript
export abstract class Acnode {
    readonly id: string;
    readonly name: string;
    readonly inputs: Map<string, Asocket>;
    readonly outputs: Map<string, Asocket>;
    metadata: Record<string, unknown>;

    addInput(socketOrName: Asocket | string): this;
    addOutput(socketOrName: Asocket | string): this;

    getInput<T extends Asocket = Asocket>(name: string): T | undefined;
    getOutput<T extends Asocket = Asocket>(name: string): T | undefined;

    allowMultipleInput(socketName: string): boolean;
    canConnectInput(inSocketName: string, outNode: Acnode, outSocketName: string, data?: any): boolean;

    process?(
        packets: Record<string, any>,
        ctx?: ProcessCtx<any>
    ): Record<string, any> | void;
}
```

- **`allowMultipleInput(socketName)`**: Controls whether an input socket permits multi-wire fan-in (defaults to `false`). When `true`, receives `Packet[]` arrays during execution.
- **`canConnectInput(inSocketName, outNode, outSocketName, data?)`**: Validation gate invoked by `circuit.connect()` prior to establishing a wire. Returns `false` to reject incompatible connections.
- **`process(packets, ctx)`**: Core evaluation hook. Receives input `Packet` structures and execution context, returning an object mapping output socket names to computed values.

### 4. Acircuit

Standalone circuit manager orchestrating socket wires and topological execution:

```typescript
export class Acircuit {
    constructor(options?: AcircuitOptions);

    addNode(node: Acnode): this;
    getNode<T extends Acnode = Acnode>(id: string): T | undefined;
    hasNode(id: string): boolean;
    removeNode(id: string): this;

    connect<TData = any>(
        outNodeOrId: Acnode | string,
        outSocketName: string,
        inNodeOrId: Acnode | string,
        inSocketName: string,
        data?: TData
    ): Awire<TData>;

    disconnect(wireOrNodeId: Awire | Acnode | string, inSocketName?: string): boolean;
    disconnectAll(nodeOrId: Acnode | string): this;

    topoSort<T extends Acnode = Acnode>(): T[];

    run<TCtx = unknown>(
        options?: RunOptions<TCtx, Acnode>
    ): RunResult<Acnode>;

    process<TCtx = unknown>(
        options?: RunOptions<TCtx, Acnode>
    ): RunResult<Acnode>;
}
```

- **`connect<TData>(outNode, outSocket, inNode, inSocket, data?)`**: Validates socket existence and node connectivity hooks (`canConnectInput`), automatically disconnects prior wires unless `allowMultipleInput` is enabled, and returns the tracking `Awire<TData>`.
- **`disconnect(wireOrNodeId, inSocketName?)`**: Polymorphic unlinking accepting either a direct `Awire` reference or an `(inNodeId, inSocketName)` pair.
- **`topoSort<T>()`**: Evaluates dependency chains using Kahn's algorithm based on active wire maps. Throws an error immediately upon cycle detection.
- **`run<TCtx>(options?)` / `process<TCtx>(options?)`**: Executes nodes in topological sequence. `options.overrides` injects initial values directly into input sockets, and `options.ctx` forwards mutable user state to `process()`. Returns `RunResult<TNode>` (`outputs`, `orderedNodes`, `errors`).

---

## Examples

### 1. Math Calculation with Packet Inputs

```typescript
import { Acircuit, Acnode, type Packet } from "../Atoolkit/acircuit/index.js";

class NumberNode extends Acnode {
    value: number;
    constructor(id: string, value: number) {
        super(id, "Number");
        this.value = value;
        this.addOutput("out");
    }
    override process() {
        return { out: this.value };
    }
}

class AddNode extends Acnode {
    constructor(id: string) {
        super(id, "Add");
        this.addInput("a").addInput("b").addOutput("sum");
    }
    override process(packets: Record<string, Packet<number> | undefined>) {
        const a = packets.a?.value ?? 0;
        const b = packets.b?.value ?? 0;
        return { sum: a + b };
    }
}

class MultiplyNode extends Acnode {
    constructor(id: string) {
        super(id, "Multiply");
        this.addInput("a").addInput("b").addOutput("product");
    }
    override process(packets: Record<string, Packet<number> | undefined>) {
        const a = packets.a?.value ?? 1;
        const b = packets.b?.value ?? 1;
        return { product: a * b };
    }
}

// Build: (5 + 10) * 3
const circuit = new Acircuit();
const n1 = new NumberNode("n1", 5);
const n2 = new NumberNode("n2", 10);
const n3 = new NumberNode("n3", 3);
const add = new AddNode("add");
const mul = new MultiplyNode("mul");

const w1 = circuit.connect(n1, "out", add, "a");
const w2 = circuit.connect(n2, "out", add, "b");
const w3 = circuit.connect(add, "sum", mul, "a");
const w4 = circuit.connect(n3, "out", mul, "b");

const res = circuit.run();
console.log(res.outputs.get("mul")?.product); // 45
```

### 2. Multi-Wire Fan-In with Wire Ordering

```typescript
import { Acnode, type Packet } from "../Atoolkit/acircuit/index.js";

class MultiJoinNode extends Acnode {
    delimiter: string;

    constructor(id: string, delimiter = ", ") {
        super(id, "Multi-Join");
        this.delimiter = delimiter;
        this.addInput("items");
        this.addOutput("out");
    }

    override allowMultipleInput(socketName: string): boolean {
        return socketName === "items";
    }

    override process(packets: Record<string, Packet<string>[]>) {
        const items = (packets.items ?? []).slice();

        // Sort items directly using wire metadata (e.g. { order: number })
        items.sort((a, b) => {
            const orderA = (a.wire?.data as any)?.order ?? 0;
            const orderB = (b.wire?.data as any)?.order ?? 0;
            return orderA - orderB;
        });

        return { out: items.map(p => p.value).filter(Boolean).join(this.delimiter) };
    }
}
```
