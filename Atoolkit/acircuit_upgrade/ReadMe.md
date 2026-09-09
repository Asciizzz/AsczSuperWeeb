# Atoolkit/acircuit_upgrade

Directed computation circuit with typed socket endpoints, 1-to-1 input connections, 1-to-N output fan-out, and topological execution.

## Architecture

- `Asocket` describes an input or output endpoint.
- `Awire` describes a directed connection between two endpoints.
- `Acnode` declares sockets and evaluates one input record through `process()`.
- `Acircuit` owns graph topology, resolves dependencies, and executes nodes.

Nodes do not cache input or output values. A circuit run resolves values into a temporary output map and passes those values to downstream nodes. Persistent state belongs to an explicit higher-level runtime or to a node whose domain requires internal state.

## API

### Acnode

```typescript
export abstract class Acnode {
    readonly id: string;
    readonly name: string;
    readonly inputs: Map<string, Asocket>;
    readonly outputs: Map<string, Asocket>;

    addInput(socketOrName: Asocket | string): this;
    addOutput(socketOrName: Asocket | string): this;

    canConnectInput(
        inSocketName: string,
        outNode: Acnode,
        outSocketName: string
    ): boolean;

    abstract process(
        inputs: Record<string, unknown>,
        ctx?: ProcessCtx
    ): Record<string, unknown>;
}
```

- `process()` receives values resolved for the current circuit run and returns output values for that run.
- Defaults belong in the derived node's immutable configuration or inside its `process()` implementation.
- `canConnectInput()` validates a proposed connection before the circuit stores it.

### Acircuit

```typescript
export class Acircuit {
    addNode(node: Acnode): this;
    removeNode(nodeOrId: Acnode | string): this;

    connect(
        outNodeOrId: Acnode | string,
        outSocketName: string,
        inNodeOrId: Acnode | string,
        inSocketName: string
    ): Awire;

    disconnect(wireOrNodeId: Awire | Acnode | string, inSocketName?: string): boolean;
    disconnectAll(nodeOrId: Acnode | string): this;
    topoSort<T extends Acnode = Acnode>(): T[];
    run<TCtx = unknown>(options?: RunOptions<TCtx, Acnode>): RunResult<Acnode>;
}
```

- `connect()` replaces an existing wire on the destination input.
- `topoSort()` uses Kahn's algorithm and throws when the graph contains a cycle.
- `run()` evaluates every node in dependency order using values local to that invocation.
- `RunOptions.overrides` supplies values for unconnected input sockets.
- Execution callbacks observe node entry, node exit, and resolved wire values without changing node state.

## Example

```typescript
class AddNode extends Acnode {
    constructor(id: string) {
        super(id, "Add");
        this.addInput("a").addInput("b").addOutput("sum");
    }

    process(inputs: Record<string, unknown>) {
        const a = typeof inputs.a === "number" ? inputs.a : 0;
        const b = typeof inputs.b === "number" ? inputs.b : 0;
        return { sum: a + b };
    }
}

const circuit = new Acircuit({ label: "MathPipeline" });
const add = new AddNode("add");
circuit.addNode(add);

const result = circuit.run({
    overrides: {
        add: { a: 10, b: 20 },
    },
});

console.log(result.outputs.get("add")?.sum); // 30
```