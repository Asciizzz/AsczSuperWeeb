import { CircuitNode, NodeProxy } from "./node.js";
import {
    type Wire,
    inSocketKey,
    outSocketKey,
    wireEquals,
} from "./wire.js";
import type {
    ProcessCtx,
    RunOptions,
    RunResult,
    CircuitValidationResult,
    CircuitIssue,
    SerializedCircuit,
    NodeFactory,
} from "./types.js";
import type { InputSocketMapping, OutputSocketMapping } from "./composite.js";

export interface CircuitOptions {
    label?: string;
}

/**
 * Directed graph with 1-to-1 input wires and 1-to-N output fan-out.
 * Node values exist only in the scope of a run.
 */
export class Circuit {
    readonly label: string;
    readonly nodes = new Map<string, CircuitNode>();

    /** Inward wires:  "inNodeId:inSocket"   -> Wire (1-to-1). */
    private readonly _inWires  = new Map<string, Wire>();
    /** Outward wires: "outNodeId:outSocket" -> Wire[] (1-to-N). */
    private readonly _outWires = new Map<string, Wire[]>();
    /** Inward wires grouped by destination node ID. */
    private readonly _nodeInWires = new Map<string, Wire[]>();
    /** Outward wires grouped by source node ID. */
    private readonly _nodeOutWires = new Map<string, Wire[]>();

    private _dirtyTopo = true;
    private _cachedOrder: CircuitNode[] = [];
    private _cachedPlan: Array<{
        node: CircuitNode;
        inputSockets: string[];
        wires: Array<Wire | undefined>;
    }> = [];

    constructor(options: CircuitOptions = {}) {
        this.label = options.label ?? "Circuit";
    }

    private _addNodeWire(map: Map<string, Wire[]>, nodeId: string, wire: Wire): void {
        const list = map.get(nodeId);
        if (list) list.push(wire);
        else map.set(nodeId, [wire]);
    }

    private _removeNodeWire(map: Map<string, Wire[]>, nodeId: string, wire: Wire): void {
        const list = map.get(nodeId);
        if (list) {
            const idx = list.findIndex(candidate => wireEquals(candidate, wire));
            if (idx >= 0) list.splice(idx, 1);
            if (list.length === 0) map.delete(nodeId);
        }
    }

    addNode(node: CircuitNode): this {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
            this._dirtyTopo = true;
        }
        return this;
    }

    hasNode(id: string): boolean {
        return this.nodes.has(id);
    }

    getNode<T extends CircuitNode = CircuitNode>(id: string): T | undefined {
        return this.nodes.get(id) as T | undefined;
    }

    removeNode(nodeOrId: CircuitNode | string): this {
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
        outNodeOrId: CircuitNode | string,
        outSocketName: string,
        inNodeOrId: CircuitNode | string,
        inSocketName: string
    ): Wire {
        const outNode = typeof outNodeOrId === "string" ? this.getNode(outNodeOrId) : outNodeOrId;
        const inNode = typeof inNodeOrId === "string" ? this.getNode(inNodeOrId) : inNodeOrId;

        if (!outNode) throw new Error(`[Circuit] Output node "${String(outNodeOrId)}" not found in graph.`);
        if (!inNode) throw new Error(`[Circuit] Input node "${String(inNodeOrId)}" not found in graph.`);

        const registeredOut = this.nodes.get(outNode.id);
        const registeredIn = this.nodes.get(inNode.id);
        if (registeredOut && registeredOut !== outNode) {
            throw new Error(`[Circuit] Node id "${outNode.id}" is already registered with a different output node.`);
        }
        if (registeredIn && registeredIn !== inNode) {
            throw new Error(`[Circuit] Node id "${inNode.id}" is already registered with a different input node.`);
        }

        this.addNode(outNode);
        this.addNode(inNode);

        if (!outNode.getOutput(outSocketName)) {
            throw new Error(`[Circuit] Node "${outNode.id}" has no output socket named "${outSocketName}".`);
        }
        if (!inNode.getInput(inSocketName)) {
            throw new Error(`[Circuit] Node "${inNode.id}" has no input socket named "${inSocketName}".`);
        }
        if (!inNode.canConnectInput(inSocketName, outNode, outSocketName)) {
            throw new Error(`[Circuit] Connection rejected by node "${inNode.id}" on input socket "${inSocketName}".`);
        }

        this.disconnect(inNode.id, inSocketName);

        const wire: Wire = {
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

    disconnect(wireOrNodeId: Wire | CircuitNode | string, inSocketName?: string): boolean {
        let wire: Wire | undefined;
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

    disconnectAll(nodeOrId: CircuitNode | string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        for (const wire of this.getIncomingWires(id)) this.disconnect(wire);
        for (const wire of this.getOutgoingWires(id)) this.disconnect(wire);
        this._dirtyTopo = true;
        return this;
    }

    getIncomingWire(nodeOrId: CircuitNode | string, socketName: string): Wire | undefined {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        return this._inWires.get(inSocketKey(id, socketName));
    }

    getIncomingWires(nodeOrId: CircuitNode | string): Wire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        return [...(this._nodeInWires.get(id) ?? [])];
    }

    getOutgoingWires(nodeOrId: CircuitNode | string, socketName?: string): Wire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        if (socketName) return [...(this._outWires.get(outSocketKey(id, socketName)) ?? [])];
        return [...(this._nodeOutWires.get(id) ?? [])];
    }

    getWires(): Wire[] {
        return Array.from(this._inWires.values());
    }

    /** Returns all nodes in dependency order and rejects cycles. */
    topoSort<T extends CircuitNode = CircuitNode>(force = false): T[] {
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

        const sorted: CircuitNode[] = [];
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
            throw new Error(`[Circuit] Cyclic dependency detected in graph "${this.label}".`);
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
    run<TCtx = unknown>(options: RunOptions<TCtx, CircuitNode> = {}): RunResult<CircuitNode> {
        this.topoSort();
        const plan = this._cachedPlan;
        const outputs = new Map<string, Record<string, any>>();
        const executedNodes: CircuitNode[] = [];
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

    /**
     * Statically analyzes graph topology without throwing errors.
     * Identifies cycles, missing required inputs, type mismatches, and isolated nodes.
     */
    validate(): CircuitValidationResult {
        const issues: CircuitIssue[] = [];

        // 1. Cycle detection pass
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

        let processed = 0;
        let head = 0;
        while (head < ready.length) {
            const nodeId = ready[head++];
            processed++;
            for (const dependentId of outDeps.get(nodeId)!) {
                const dependencies = inDeps.get(dependentId)!;
                dependencies.delete(nodeId);
                if (dependencies.size === 0) ready.push(dependentId);
            }
        }

        if (processed !== this.nodes.size) {
            issues.push({
                type: "cycle",
                message: `Cyclic dependency detected in graph "${this.label}".`,
            });
        }

        // 2. Missing required inputs pass
        for (const node of this.nodes.values()) {
            for (const socket of node.inputs.values()) {
                if (socket.required && !this.getIncomingWire(node.id, socket.name)) {
                    issues.push({
                        type: "missing_input",
                        message: `Required input "${socket.name}" on node "${node.id}" has no incoming wire.`,
                        nodeId: node.id,
                        socketName: socket.name,
                    });
                }
            }
        }

        // 3. Socket type mismatch pass
        for (const wire of this._inWires.values()) {
            const outNode = this.nodes.get(wire.outNodeId);
            const inNode = this.nodes.get(wire.inNodeId);
            if (!outNode || !inNode) continue;

            const outSocket = outNode.getOutput(wire.outSocket);
            const inSocket = inNode.getInput(wire.inSocket);
            if (!outSocket || !inSocket) continue;

            if (outSocket.dataType !== undefined && inSocket.dataType !== undefined) {
                if (outSocket.dataType !== "any" && inSocket.dataType !== "any" && outSocket.dataType !== inSocket.dataType) {
                    issues.push({
                        type: "type_mismatch",
                        message: `Type mismatch on wire (${wire.outNodeId}:${wire.outSocket} [${outSocket.dataType}] -> ${wire.inNodeId}:${wire.inSocket} [${inSocket.dataType}]).`,
                        nodeId: wire.inNodeId,
                        socketName: wire.inSocket,
                        wire,
                    });
                }
            }
        }

        // 4. Isolated nodes pass
        for (const node of this.nodes.values()) {
            const inWires = this.getIncomingWires(node.id);
            const outWires = this.getOutgoingWires(node.id);
            if (inWires.length === 0 && outWires.length === 0) {
                issues.push({
                    type: "isolated_node",
                    message: `Node "${node.id}" has zero connections.`,
                    nodeId: node.id,
                });
            }
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }

    /** Returns nodes with indegree 0 (zero incoming connections). */
    getSources(): CircuitNode[] {
        const sources: CircuitNode[] = [];
        for (const node of this.nodes.values()) {
            if (this.getIncomingWires(node.id).length === 0) {
                sources.push(node);
            }
        }
        return sources;
    }

    /** Returns nodes with outdegree 0 (zero outgoing connections). */
    getSinks(): CircuitNode[] {
        const sinks: CircuitNode[] = [];
        for (const node of this.nodes.values()) {
            if (this.getOutgoingWires(node.id).length === 0) {
                sinks.push(node);
            }
        }
        return sinks;
    }

    /** Returns all transitive upstream ancestor nodes feeding into the target node. */
    getUpstreamNodes(nodeOrId: CircuitNode | string): Set<CircuitNode> {
        const targetId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        const result = new Set<CircuitNode>();
        const queue: string[] = [targetId];
        const visited = new Set<string>([targetId]);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const inWires = this.getIncomingWires(currentId);
            for (let i = 0; i < inWires.length; i++) {
                const upId = inWires[i].outNodeId;
                if (!visited.has(upId)) {
                    visited.add(upId);
                    const upNode = this.nodes.get(upId);
                    if (upNode) {
                        result.add(upNode);
                        queue.push(upId);
                    }
                }
            }
        }
        return result;
    }

    /** Returns all transitive downstream descendant nodes fed by the target node. */
    getDownstreamNodes(nodeOrId: CircuitNode | string): Set<CircuitNode> {
        const targetId = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        const result = new Set<CircuitNode>();
        const queue: string[] = [targetId];
        const visited = new Set<string>([targetId]);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            const outWires = this.getOutgoingWires(currentId);
            for (let i = 0; i < outWires.length; i++) {
                const downId = outWires[i].inNodeId;
                if (!visited.has(downId)) {
                    visited.add(downId);
                    const downNode = this.nodes.get(downId);
                    if (downNode) {
                        result.add(downNode);
                        queue.push(downId);
                    }
                }
            }
        }
        return result;
    }

    /** Returns whether a directed path exists from source node to target node. */
    isReachable(fromNodeOrId: CircuitNode | string, toNodeOrId: CircuitNode | string): boolean {
        const targetId = typeof toNodeOrId === "string" ? toNodeOrId : toNodeOrId.id;
        const downstream = this.getDownstreamNodes(fromNodeOrId);
        for (const node of downstream) {
            if (node.id === targetId) return true;
        }
        return false;
    }

    /**
     * Dead code elimination: prunes nodes that do not reach target nodes.
     * When targetNodeIds is omitted, preserves all nodes reaching circuit sinks.
     */
    pruneUnreachable(targetNodeIds?: string[]): this {
        const retainIds = new Set<string>();

        const seeds = targetNodeIds !== undefined
            ? targetNodeIds
            : this.getSinks().map(n => n.id);

        for (let i = 0; i < seeds.length; i++) {
            const seedId = seeds[i];
            if (this.nodes.has(seedId)) {
                retainIds.add(seedId);
                const upstream = this.getUpstreamNodes(seedId);
                for (const up of upstream) {
                    retainIds.add(up.id);
                }
            }
        }

        for (const nodeId of Array.from(this.nodes.keys())) {
            if (!retainIds.has(nodeId)) {
                this.removeNode(nodeId);
            }
        }

        return this;
    }

    /**
     * Extracts an isolated subcircuit containing only the specified target nodes,
     * their transitive upstream dependencies, and internal interconnecting wires.
     */
    extractSubgraph(targetNodeIds: string[], options: CircuitOptions = {}): Circuit {
        const sub = new Circuit({ label: options.label ?? `${this.label}_subgraph` });
        const retainIds = new Set<string>();

        for (let i = 0; i < targetNodeIds.length; i++) {
            const seedId = targetNodeIds[i];
            if (this.nodes.has(seedId)) {
                retainIds.add(seedId);
                const upstream = this.getUpstreamNodes(seedId);
                for (const up of upstream) {
                    retainIds.add(up.id);
                }
            }
        }

        for (const id of retainIds) {
            const node = this.nodes.get(id);
            if (node) {
                const nodeCopy = (typeof (node as any).clone === "function")
                    ? (node as any).clone(node.id)
                    : new NodeProxy(node.id, node);
                sub.addNode(nodeCopy);
            }
        }

        for (const wire of this._inWires.values()) {
            if (retainIds.has(wire.outNodeId) && retainIds.has(wire.inNodeId)) {
                sub.connect(wire.outNodeId, wire.outSocket, wire.inNodeId, wire.inSocket);
            }
        }

        return sub;
    }

    /**
     * Inlines a composite subcircuit node directly into this graph,
     * expanding its inner nodes and rerouting external wires.
     */
    flatten(nodeOrId: CircuitNode | string, prefix?: string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        const node = this.getNode(id);
        if (!node) {
            throw new Error(`[Circuit] Node "${id}" not found in circuit.`);
        }

        const composite = node as any;
        if (!composite.innerCircuit || !composite.inputMappings || !composite.outputMappings) {
            throw new Error(`[Circuit] Node "${id}" is not a composite subcircuit node.`);
        }

        const innerCircuit = composite.innerCircuit as Circuit;
        const p = prefix ?? `${id}_`;

        // 1. Inline internal nodes
        for (const innerNode of innerCircuit.nodes.values()) {
            const inlinedId = `${p}${innerNode.id}`;
            const cloned = (typeof (innerNode as any).clone === "function")
                ? (innerNode as any).clone(inlinedId)
                : new NodeProxy(inlinedId, innerNode);
            this.addNode(cloned);
        }

        // 2. Inline internal wires
        for (const wire of innerCircuit.getWires()) {
            this.connect(
                `${p}${wire.outNodeId}`,
                wire.outSocket,
                `${p}${wire.inNodeId}`,
                wire.inSocket
            );
        }

        // 3. Reroute incoming external wires to inner targets
        const inWires = this.getIncomingWires(id);
        for (let i = 0; i < inWires.length; i++) {
            const inWire = inWires[i];
            const mapping = composite.inputMappings.get(inWire.inSocket) as InputSocketMapping | undefined;
            if (mapping) {
                this.connect(
                    inWire.outNodeId,
                    inWire.outSocket,
                    `${p}${mapping.innerNodeId}`,
                    mapping.innerSocket
                );
            }
        }

        // 4. Reroute outgoing external wires from inner sources
        const outWires = this.getOutgoingWires(id);
        for (let i = 0; i < outWires.length; i++) {
            const outWire = outWires[i];
            const mapping = composite.outputMappings.get(outWire.outSocket) as OutputSocketMapping | undefined;
            if (mapping) {
                this.connect(
                    `${p}${mapping.innerNodeId}`,
                    mapping.innerSocket,
                    outWire.inNodeId,
                    outWire.inSocket
                );
            }
        }

        // 5. Remove original composite wrapper
        this.removeNode(id);
        return this;
    }

    /** Clones this circuit graph with optional custom node factory. */
    clone(nodeCloner?: (node: CircuitNode) => CircuitNode): Circuit {
        const cloner = nodeCloner ?? ((n: CircuitNode) => (
            typeof (n as any).clone === "function"
                ? (n as any).clone(n.id)
                : new NodeProxy(n.id, n)
        ));

        const copy = new Circuit({ label: this.label });
        for (const node of this.nodes.values()) {
            copy.addNode(cloner(node));
        }
        for (const wire of this.getWires()) {
            copy.connect(wire.outNodeId, wire.outSocket, wire.inNodeId, wire.inSocket);
        }
        return copy;
    }

    /** Merges another circuit graph into this one, optionally applying a prefix to node IDs. */
    merge(other: Circuit, prefix = ""): this {
        for (const node of other.nodes.values()) {
            const newId = prefix ? `${prefix}${node.id}` : node.id;
            const nodeCopy = (typeof (node as any).clone === "function")
                ? (node as any).clone(newId)
                : new NodeProxy(newId, node);
            this.addNode(nodeCopy);
        }
        for (const wire of other.getWires()) {
            const outId = prefix ? `${prefix}${wire.outNodeId}` : wire.outNodeId;
            const inId = prefix ? `${prefix}${wire.inNodeId}` : wire.inNodeId;
            this.connect(outId, wire.outSocket, inId, wire.inSocket);
        }
        return this;
    }

    /** Serializes circuit topology into a portable JSON structure. */
    toJSON(): SerializedCircuit {
        return {
            label: this.label,
            nodes: Array.from(this.nodes.values()).map(node => ({
                id: node.id,
                name: node.name,
                inputs: Array.from(node.inputs.values()).map(s => ({
                    name: s.name,
                    direction: s.direction,
                    dataType: s.dataType,
                    required: s.required,
                })),
                outputs: Array.from(node.outputs.values()).map(s => ({
                    name: s.name,
                    direction: s.direction,
                    dataType: s.dataType,
                })),
                metadata: Object.keys(node.metadata).length > 0 ? { ...node.metadata } : undefined,
            })),
            wires: this.getWires(),
        };
    }

    /** Reconstructs a Circuit graph from serialized JSON using a node factory. */
    static fromJSON(json: SerializedCircuit, nodeFactory: NodeFactory): Circuit {
        const circuit = new Circuit({ label: json.label });
        for (let i = 0; i < json.nodes.length; i++) {
            const node = nodeFactory(json.nodes[i]);
            circuit.addNode(node);
        }
        for (let i = 0; i < json.wires.length; i++) {
            const w = json.wires[i];
            circuit.connect(w.outNodeId, w.outSocket, w.inNodeId, w.inSocket);
        }
        return circuit;
    }
}
