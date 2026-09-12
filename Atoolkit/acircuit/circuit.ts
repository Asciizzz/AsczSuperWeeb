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
    /** Inward wires grouped by destination node ID. */
    private readonly _nodeInWires = new Map<string, Awire[]>();
    /** Outward wires grouped by source node ID. */
    private readonly _nodeOutWires = new Map<string, Awire[]>();

    private _dirtyTopo = true;
    private _cachedOrder: Acnode[] = [];
    private _cachedPlan: Array<{
        node: Acnode;
        inputSockets: string[];
        wires: Array<Awire | undefined>;
    }> = [];

    constructor(options: AcircuitOptions = {}) {
        this.label = options.label ?? "Acircuit";
    }

    private _addNodeWire(map: Map<string, Awire[]>, nodeId: string, wire: Awire): void {
        const list = map.get(nodeId);
        if (list) list.push(wire);
        else map.set(nodeId, [wire]);
    }

    private _removeNodeWire(map: Map<string, Awire[]>, nodeId: string, wire: Awire): void {
        const list = map.get(nodeId);
        if (list) {
            const idx = list.findIndex(candidate => wireEquals(candidate, wire));
            if (idx >= 0) list.splice(idx, 1);
            if (list.length === 0) map.delete(nodeId);
        }
    }

    addNode(node: Acnode): this {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
            this._dirtyTopo = true;
        }
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
        if (this.nodes.delete(id)) {
            this._dirtyTopo = true;
        }
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

        const registeredOut = this.nodes.get(outNode.id);
        const registeredIn = this.nodes.get(inNode.id);
        if (registeredOut && registeredOut !== outNode) {
            throw new Error(`[Acircuit] Node id "${outNode.id}" is already registered with a different output node.`);
        }
        if (registeredIn && registeredIn !== inNode) {
            throw new Error(`[Acircuit] Node id "${inNode.id}" is already registered with a different input node.`);
        }

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
        this._addNodeWire(this._nodeInWires, inNode.id, wire);

        const outKey = outSocketKey(outNode.id, outSocketName);
        const outWires = this._outWires.get(outKey);
        if (outWires) outWires.push(wire);
        else this._outWires.set(outKey, [wire]);
        this._addNodeWire(this._nodeOutWires, outNode.id, wire);

        this._dirtyTopo = true;
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

        const inKey = inSocketKey(wire.inNodeId, wire.inSocket);
        const existing = this._inWires.get(inKey);
        if (!existing || !wireEquals(existing, wire)) return false;

        this._inWires.delete(inKey);
        this._removeNodeWire(this._nodeInWires, wire.inNodeId, wire);

        const outKey = outSocketKey(wire.outNodeId, wire.outSocket);
        const outWires = this._outWires.get(outKey);
        if (outWires) {
            const index = outWires.findIndex(candidate => wireEquals(candidate, wire!));
            if (index >= 0) outWires.splice(index, 1);
            if (outWires.length === 0) this._outWires.delete(outKey);
        }
        this._removeNodeWire(this._nodeOutWires, wire.outNodeId, wire);

        this._dirtyTopo = true;
        return true;
    }

    disconnectAll(nodeOrId: Acnode | string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        for (const wire of this.getIncomingWires(id)) this.disconnect(wire);
        for (const wire of this.getOutgoingWires(id)) this.disconnect(wire);
        this._dirtyTopo = true;
        return this;
    }

    getIncomingWire(nodeOrId: Acnode | string, socketName: string): Awire | undefined {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        return this._inWires.get(inSocketKey(id, socketName));
    }

    getIncomingWires(nodeOrId: Acnode | string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        return [...(this._nodeInWires.get(id) ?? [])];
    }

    getOutgoingWires(nodeOrId: Acnode | string, socketName?: string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        if (socketName) return [...(this._outWires.get(outSocketKey(id, socketName)) ?? [])];
        return [...(this._nodeOutWires.get(id) ?? [])];
    }

    getWires(): Awire[] {
        return Array.from(this._inWires.values());
    }

    /** Returns all nodes in dependency order and rejects cycles. */
    topoSort<T extends Acnode = Acnode>(force = false): T[] {
        if (!this._dirtyTopo && !force) {
            return this._cachedOrder as T[];
        }

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
        this._cachedOrder = sorted;
        this._cachedPlan = sorted.map(node => {
            const inputSockets = Array.from(node.inputs.keys());
            const wires = inputSockets.map(s => this.getIncomingWire(node, s));
            return { node, inputSockets, wires };
        });
        this._dirtyTopo = false;
        return sorted as T[];
    }

    /** Executes nodes in topological order with run-local input and output values. */
    run<TCtx = unknown>(options: RunOptions<TCtx, Acnode> = {}): RunResult<Acnode> {
        this.topoSort();
        const plan = this._cachedPlan;
        const outputs = new Map<string, Record<string, any>>();
        const executedNodes: Acnode[] = [];
        const errors: Array<{ nodeId: string; error: unknown }> = [];

        const ctx: ProcessCtx<TCtx> = { ctx: options.ctx };
        const overrides = options.overrides;
        const onWireTransmit = options.onWireTransmit;
        const onNodeEnter = options.onNodeEnter;
        const onNodeLeave = options.onNodeLeave;

        for (let i = 0; i < plan.length; i++) {
            const step = plan[i];
            const node = step.node;
            const sockets = step.inputSockets;
            const wires = step.wires;
            const socketCount = sockets.length;
            const inputs: Record<string, any> = {};

            for (let s = 0; s < socketCount; s++) {
                const socketName = sockets[s];
                const wire = wires[s];
                if (!wire) {
                    inputs[socketName] = overrides?.[node.id]?.[socketName];
                    continue;
                }

                const value = outputs.get(wire.outNodeId)?.[wire.outSocket];
                inputs[socketName] = value;
                if (value !== undefined) onWireTransmit?.(wire, value);
            }

            onNodeEnter?.(node, inputs);

            let nodeOutputs: Record<string, any> = {};
            try {
                nodeOutputs = node.process(inputs, ctx);
            } catch (error) {
                errors.push({ nodeId: node.id, error });
            }

            outputs.set(node.id, nodeOutputs);
            executedNodes.push(node);
            onNodeLeave?.(node, nodeOutputs);
        }

        return { outputs, executedNodes, errors };
    }

}

