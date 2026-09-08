import { Acnode } from "./node.js";
import type { Awire } from "./wire.js";
import type {
    Packet,
    RunOptions,
    RunResult,
    ProcessCtx,
} from "./types.js";

export interface AcircuitOptions {
    label?: string;
}

export class Acircuit {    
    readonly label: string;
    readonly nodes = new Map<string, Acnode>();

    /** Inward wires: "inNodeId:inSocket" -> Awire[] */
    private readonly _inWires = new Map<string, Awire[]>();

    /** Outward wires: "outNodeId:outSocket" -> Awire[] */
    private readonly _outWires = new Map<string, Awire[]>();

    constructor(options: AcircuitOptions = {}) {
        this.label = options.label ?? "Acircuit";
    }

    addNode(node: Acnode): this {
        if (this.nodes.has(node.id)) return this;
        this.nodes.set(node.id, node);
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
     * Connect an output socket to an input socket.
     * Returns the created Awire instance.
     */
    connect<TData = any>(
        outNodeOrId: Acnode | string,
        outSocketName: string,
        inNodeOrId: Acnode | string,
        inSocketName: string,
        data?: TData
    ): Awire<TData> {
        const outNode = typeof outNodeOrId === "string" ? this.getNode(outNodeOrId) : outNodeOrId;
        const inNode = typeof inNodeOrId === "string" ? this.getNode(inNodeOrId) : inNodeOrId;

        if (!outNode) throw new Error(`[Acircuit] Output node "${String(outNodeOrId)}" not found in graph.`);
        if (!inNode) throw new Error(`[Acircuit] Input node "${String(inNodeOrId)}" not found in graph.`);

        if (!this.hasNode(outNode.id)) this.addNode(outNode);
        if (!this.hasNode(inNode.id)) this.addNode(inNode);

        const outSocketObj = outNode.getOutput(outSocketName);
        if (!outSocketObj) throw new Error(`[Acircuit] Node "${outNode.id}" has no output socket named "${outSocketName}".`);

        const inSocketObj = inNode.getInput(inSocketName);
        if (!inSocketObj) throw new Error(`[Acircuit] Node "${inNode.id}" has no input socket named "${inSocketName}".`);

        if (inNode.canConnectInput && !inNode.canConnectInput(inSocketName, outNode, outSocketName, data)) {
            throw new Error(`[Acircuit] Connection rejected by node "${inNode.id}" on input socket "${inSocketName}".`);
        }

        const allowMultiple = inNode.allowMultipleInput ? inNode.allowMultipleInput(inSocketName) : false;
        if (!allowMultiple) {
            this.disconnect(inNode.id, inSocketName);
        }

        const wire: Awire<TData> = {
            outNodeId: outNode.id,
            outSocket: outSocketName,
            inNodeId: inNode.id,
            inSocket: inSocketName,
            data,
        };

        const inKey = `${inNode.id}:${inSocketName}`;
        const inList = this._inWires.get(inKey);
        if (inList) {
            inList.push(wire);
        } else {
            this._inWires.set(inKey, [wire]);
        }

        const outKey = `${outNode.id}:${outSocketName}`;
        const outList = this._outWires.get(outKey);
        if (outList) {
            outList.push(wire);
        } else {
            this._outWires.set(outKey, [wire]);
        }

        return wire;
    }

    /**
     * Disconnects a specific Awire, or all wires on a given input socket.
     */
    disconnect(wireOrNodeId: Awire | Acnode | string, inSocketName?: string): boolean {
        if (typeof wireOrNodeId === "object" && "outNodeId" in wireOrNodeId) {
            const wire = wireOrNodeId as Awire;
            let removed = false;

            const inKey = `${wire.inNodeId}:${wire.inSocket}`;
            const inList = this._inWires.get(inKey);
            if (inList) {
                const idx = inList.indexOf(wire);
                if (idx >= 0) {
                    inList.splice(idx, 1);
                    removed = true;
                    if (inList.length === 0) this._inWires.delete(inKey);
                }
            }

            const outKey = `${wire.outNodeId}:${wire.outSocket}`;
            const outList = this._outWires.get(outKey);
            if (outList) {
                const idx = outList.indexOf(wire);
                if (idx >= 0) {
                    outList.splice(idx, 1);
                    removed = true;
                    if (outList.length === 0) this._outWires.delete(outKey);
                }
            }

            return removed;
        }

        const inId = typeof wireOrNodeId === "string" ? wireOrNodeId : wireOrNodeId.id;
        if (!inSocketName) return false;

        const inKey = `${inId}:${inSocketName}`;
        const wires = this._inWires.get(inKey);
        if (!wires || wires.length === 0) return false;

        for (const wire of wires) {
            const outKey = `${wire.outNodeId}:${wire.outSocket}`;
            const outList = this._outWires.get(outKey);
            if (outList) {
                const idx = outList.indexOf(wire);
                if (idx >= 0) outList.splice(idx, 1);
                if (outList.length === 0) this._outWires.delete(outKey);
            }
        }
        return this._inWires.delete(inKey);
    }

    disconnectAll(nodeOrId: Acnode | string): this {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;

        for (const [inKey, wires] of Array.from(this._inWires.entries())) {
            if (wires[0]?.inNodeId === id) {
                for (const wire of wires) {
                    const outKey = `${wire.outNodeId}:${wire.outSocket}`;
                    const outList = this._outWires.get(outKey);
                    if (outList) {
                        const idx = outList.indexOf(wire);
                        if (idx >= 0) outList.splice(idx, 1);
                        if (outList.length === 0) this._outWires.delete(outKey);
                    }
                }
                this._inWires.delete(inKey);
            }
        }

        for (const [outKey, wires] of Array.from(this._outWires.entries())) {
            if (wires[0]?.outNodeId === id) {
                for (const wire of wires) {
                    const inKey = `${wire.inNodeId}:${wire.inSocket}`;
                    const inList = this._inWires.get(inKey);
                    if (inList) {
                        const idx = inList.indexOf(wire);
                        if (idx >= 0) inList.splice(idx, 1);
                        if (inList.length === 0) this._inWires.delete(inKey);
                    }
                }
                this._outWires.delete(outKey);
            }
        }

        return this;
    }

    getIncomingWire(nodeOrId: Acnode | string, socketName: string): Awire | undefined {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        const wires = this._inWires.get(`${id}:${socketName}`);
        return wires && wires.length > 0 ? wires[0] : undefined;
    }

    getIncomingWires(nodeOrId: Acnode | string, socketName?: string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        if (socketName) {
            return this._inWires.get(`${id}:${socketName}`) ?? [];
        }
        const result: Awire[] = [];
        for (const [key, wires] of this._inWires) {
            if (key.startsWith(`${id}:`)) {
                result.push(...wires);
            }
        }
        return result;
    }

    getOutgoingWires(nodeOrId: Acnode | string, socketName?: string): Awire[] {
        const id = typeof nodeOrId === "string" ? nodeOrId : nodeOrId.id;
        if (socketName) {
            return this._outWires.get(`${id}:${socketName}`) ?? [];
        }
        const result: Awire[] = [];
        for (const [key, wires] of this._outWires) {
            if (key.startsWith(`${id}:`)) {
                result.push(...wires);
            }
        }
        return result;
    }

    getWires(): Awire[] {
        const result: Awire[] = [];
        for (const wires of this._inWires.values()) {
            result.push(...wires);
        }
        return result;
    }

    topoSort<T extends Acnode = Acnode>(): T[] {
        const inDeps = new Map<string, Set<string>>();
        const outDeps = new Map<string, Set<string>>();

        for (const nodeId of this.nodes.keys()) {
            inDeps.set(nodeId, new Set());
            outDeps.set(nodeId, new Set());
        }

        for (const wires of this._inWires.values()) {
            for (const wire of wires) {
                if (this.nodes.has(wire.outNodeId) && this.nodes.has(wire.inNodeId)) {
                    inDeps.get(wire.inNodeId)!.add(wire.outNodeId);
                    outDeps.get(wire.outNodeId)!.add(wire.inNodeId);
                }
            }
        }

        const readyQueue: string[] = [];
        for (const [nodeId, deps] of inDeps) {
            if (deps.size === 0) readyQueue.push(nodeId);
        }

        const sorted: Acnode[] = [];
        while (readyQueue.length > 0) {
            const currentId = readyQueue.shift()!;
            const node = this.nodes.get(currentId);
            if (node) sorted.push(node);

            for (const dependentId of outDeps.get(currentId)!) {
                const depSet = inDeps.get(dependentId)!;
                depSet.delete(currentId);
                if (depSet.size === 0) readyQueue.push(dependentId);
            }
        }

        if (sorted.length !== this.nodes.size) {
            throw new Error(`[Acircuit] Cyclic dependency detected in graph "${this.label}".`);
        }

        return sorted as T[];
    }

    run<TCtx = unknown>(
        options: RunOptions<TCtx, Acnode> = {}
    ): RunResult<Acnode> {
        const sorted = this.topoSort();
        const nodeOutputs = new Map<string, Record<string, any>>();
        const errors: Array<{ nodeId: string; error: unknown }> = [];

        for (const node of sorted) {
            const resolvedPackets: Record<string, any> = {};

            for (const [inputName] of node.inputs) {
                const isMulti = node.allowMultipleInput ? node.allowMultipleInput(inputName) : false;

                if (options.overrides?.[node.id]?.[inputName] !== undefined) {
                    const overrideVal = options.overrides[node.id][inputName];
                    resolvedPackets[inputName] = isMulti
                        ? [{ value: overrideVal, wire: undefined }]
                        : { value: overrideVal, wire: undefined };
                    continue;
                }

                const wires = this.getIncomingWires(node.id, inputName);

                if (isMulti) {
                    resolvedPackets[inputName] = wires.map(w => {
                        const outMap = nodeOutputs.get(w.outNodeId);
                        return {
                            value: outMap ? outMap[w.outSocket] : undefined,
                            wire: w,
                        } as Packet;
                    });
                } else {
                    if (wires.length > 0) {
                        const w = wires[0];
                        const outMap = nodeOutputs.get(w.outNodeId);
                        resolvedPackets[inputName] = {
                            value: outMap ? outMap[w.outSocket] : undefined,
                            wire: w,
                        } as Packet;
                    } else {
                        resolvedPackets[inputName] = undefined;
                    }
                }
            }

            options.onNodeEnter?.(node, resolvedPackets);

            const processCtx: ProcessCtx<TCtx> = {
                ctx: options.ctx,
                varPrefix: `node_${node.id}`,
                meta: options.meta,
            };

            let outputResult: Record<string, any> | void = undefined;
            if (typeof node.process === "function") {
                try {
                    outputResult = node.process(resolvedPackets, processCtx);
                    nodeOutputs.set(node.id, outputResult ?? {});
                } catch (err) {
                    errors.push({ nodeId: node.id, error: err });
                    nodeOutputs.set(node.id, {});
                }
            } else {
                nodeOutputs.set(node.id, {});
            }

            options.onNodeLeave?.(node, (outputResult as Record<string, any>) ?? {});
        }

        return {
            outputs: nodeOutputs,
            orderedNodes: sorted,
            errors,
        };
    }

    process<TCtx = unknown>(
        options: RunOptions<TCtx, Acnode> = {}
    ): RunResult<Acnode> {
        return this.run(options);
    }
}

export { Acircuit as Adataflow, type AcircuitOptions as AdataflowOptions };
