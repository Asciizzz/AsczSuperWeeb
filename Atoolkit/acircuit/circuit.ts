import { Acnode } from "./node.js";
import {
    type Awire,
    inSocketKey,
    outSocketKey,
    wireEquals,
} from "./wire.js";
import type {
    ProcessCtx,
    RunOptions,
    RunResult,
} from "./types.js";

export interface AcircuitOptions {
    label?: string;
}

/**
 * Directed graph with 1-to-1 input wires and 1-to-N output fan-out.
 * Node values exist only in the scope of a run.
 */
export class Acircuit {
    readonly label: string;
    readonly nodes = new Map<string, Acnode>();

    /** Inward wires:  "inNodeId:inSocket"   -> Awire (1-to-1). */
    private readonly _inWires  = new Map<string, Awire>();
    /** Outward wires: "outNodeId:outSocket" -> Awire[] (1-to-N). */
    private readonly _outWires = new Map<string, Awire[]>();

    constructor(options: AcircuitOptions = {}) {
        this.label = options.label ?? "Acircuit";
    }

    addNode(node: Acnode): this {
        if (!this.nodes.has(node.id)) this.nodes.set(node.id, node);
        return this;
    }

    hasNode(id: string): boolean {
        return this.nodes.has(id);
    }

    getNode<T extends Acnode = Acnode>(id: string): T | undefined {
        return this.nodes.get(id) as T | undefined;
    }

    removeNode(nodeOrId: Acnode | string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        this.disconnectAll(id);
        this.nodes.delete(id);
        return this;
    }

    /**
     * Connects an output socket to an input socket, replacing any existing
     * connection on the destination input.
     */
    connect(
        outNodeOrId: Acnode | string,
        outSocketName: string,
        inNodeOrId: Acnode | string,
        inSocketName: string
    ): Awire {
        const outNode = typeof outNodeOrId === "string" ? this.getNode(outNodeOrId) : outNodeOrId;
        const inNode = typeof inNodeOrId === "string" ? this.getNode(inNodeOrId) : inNodeOrId;

        if (!outNode) throw new Error(`[Acircuit] Output node "${String(outNodeOrId)}" not found in graph.`);
        if (!inNode) throw new Error(`[Acircuit] Input node "${String(inNodeOrId)}" not found in graph.`);

        this.addNode(outNode);
        this.addNode(inNode);

        if (!outNode.getOutput(outSocketName)) {
            throw new Error(`[Acircuit] Node "${outNode.id}" has no output socket named "${outSocketName}".`);
        }
        if (!inNode.getInput(inSocketName)) {
            throw new Error(`[Acircuit] Node "${inNode.id}" has no input socket named "${inSocketName}".`);
        }
        if (!inNode.canConnectInput(inSocketName, outNode, outSocketName)) {
            throw new Error(`[Acircuit] Connection rejected by node "${inNode.id}" on input socket "${inSocketName}".`);
        }

        this.disconnect(inNode.id, inSocketName);

        const wire: Awire = {
            outNodeId: outNode.id,
            outSocket: outSocketName,
            inNodeId: inNode.id,
            inSocket: inSocketName,
        };

        this._inWires.set(inSocketKey(inNode.id, inSocketName), wire);
        const outKey = outSocketKey(outNode.id, outSocketName);
        const outWires = this._outWires.get(outKey);
        if (outWires) outWires.push(wire);
        else this._outWires.set(outKey, [wire]);
        return wire;
    }

    disconnect(wireOrNodeId: Awire | Acnode | string, inSocketName?: string): boolean {
        let wire: Awire | undefined;
        if (typeof wireOrNodeId === "object" && "outNodeId" in wireOrNodeId) {
            wire = wireOrNodeId;
        } else if (inSocketName !== undefined) {
            const nodeId = typeof wireOrNodeId === "string" ? wireOrNodeId : wireOrNodeId.id;
            wire = this._inWires.get(inSocketKey(nodeId, inSocketName));
        }
        if (!wire) return false;

        this._inWires.delete(inSocketKey(wire.inNodeId, wire.inSocket));
        const outKey = outSocketKey(wire.outNodeId, wire.outSocket);
        const outWires = this._outWires.get(outKey);
        if (outWires) {
            const index = outWires.findIndex(candidate => wireEquals(candidate, wire!));
            if (index >= 0) outWires.splice(index, 1);
            if (outWires.length === 0) this._outWires.delete(outKey);
        }
        return true;
    }

    disconnectAll(nodeOrId: Acnode | string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        for (const wire of this.getIncomingWires(id)) this.disconnect(wire);
        for (const wire of this.getOutgoingWires(id)) this.disconnect(wire);
        return this;
    }

    getIncomingWire(nodeOrId: Acnode | string, socketName: string): Awire | undefined {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        return this._inWires.get(inSocketKey(id, socketName));
    }

    getIncomingWires(nodeOrId: Acnode | string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        const result: Awire[] = [];
        for (const wire of this._inWires.values()) {
            if (wire.inNodeId === id) result.push(wire);
        }
        return result;
    }

    getOutgoingWires(nodeOrId: Acnode | string, socketName?: string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        if (socketName) return this._outWires.get(outSocketKey(id, socketName)) ?? [];

        const result: Awire[] = [];
        for (const [key, wires] of this._outWires) {
            if (key.startsWith(`${id}:`)) result.push(...wires);
        }
        return result;
    }

    getWires(): Awire[] {
        return Array.from(this._inWires.values());
    }

    /** Returns all nodes in dependency order and rejects cycles. */
    topoSort<T extends Acnode = Acnode>(): T[] {
        const inDeps = new Map<string, Set<string>>();
        const outDeps = new Map<string, Set<string>>();

        for (const nodeId of this.nodes.keys()) {
            inDeps.set(nodeId, new Set());
            outDeps.set(nodeId, new Set());
        }
        for (const wire of this._inWires.values()) {
            if (!this.nodes.has(wire.outNodeId) || !this.nodes.has(wire.inNodeId)) continue;
            inDeps.get(wire.inNodeId)!.add(wire.outNodeId);
            outDeps.get(wire.outNodeId)!.add(wire.inNodeId);
        }

        const ready: string[] = [];
        for (const [nodeId, dependencies] of inDeps) {
            if (dependencies.size === 0) ready.push(nodeId);
        }

        const sorted: Acnode[] = [];
        let head = 0;
        while (head < ready.length) {
            const nodeId = ready[head++];
            const node = this.nodes.get(nodeId);
            if (node) sorted.push(node);

            for (const dependentId of outDeps.get(nodeId)!) {
                const dependencies = inDeps.get(dependentId)!;
                dependencies.delete(nodeId);
                if (dependencies.size === 0) ready.push(dependentId);
            }
        }

        if (sorted.length !== this.nodes.size) {
            throw new Error(`[Acircuit] Cyclic dependency detected in graph "${this.label}".`);
        }
        return sorted as T[];
    }

    /** Executes nodes in topological order with run-local input and output values. */
    run<TCtx = unknown>(options: RunOptions<TCtx, Acnode> = {}): RunResult<Acnode> {
        const outputs = new Map<string, Record<string, any>>();
        const executedNodes: Acnode[] = [];
        const errors: Array<{ nodeId: string; error: unknown }> = [];

        for (const node of this.topoSort<Acnode>()) {
            const inputs: Record<string, any> = {};
            for (const socketName of node.inputs.keys()) {
                const wire = this.getIncomingWire(node, socketName);
                if (!wire) {
                    inputs[socketName] = options.overrides?.[node.id]?.[socketName];
                    continue;
                }

                const value = outputs.get(wire.outNodeId)?.[wire.outSocket];
                inputs[socketName] = value;
                if (value !== undefined) options.onWireTransmit?.(wire, value);
            }

            options.onNodeEnter?.(node, inputs);
            const ctx: ProcessCtx<TCtx> = {
                ctx: options.ctx
            };

            let nodeOutputs: Record<string, any> = {};
            try {
                nodeOutputs = node.process(inputs, ctx);
            } catch (error) {
                errors.push({ nodeId: node.id, error });
            }

            outputs.set(node.id, nodeOutputs);
            executedNodes.push(node);
            options.onNodeLeave?.(node, nodeOutputs);
        }

        return { outputs, executedNodes, errors };
    }

}

