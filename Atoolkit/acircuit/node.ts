import { Socket, type SocketOptions } from "./socket.js";
import type { ProcessCtx } from "./types.js";

/**
 * Stateless computational unit with 1-to-1 input sockets and 1-to-N output sockets.
 */
export abstract class CircuitNode {
    readonly id: string;
    readonly name: string;
    readonly inputs = new Map<string, Socket>();
    readonly outputs = new Map<string, Socket>();
    readonly metadata: Record<string, any> = {};

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    /**
     * Registers an input socket.
     */
    addInput(socketOrName: Socket | string, options?: string | SocketOptions): this {
        let socket: Socket;
        if (typeof socketOrName === "string") {
            socket = new Socket(socketOrName, "input", options);
        } else {
            socket = socketOrName;
        }
        if (socket.direction !== "input") {
            throw new Error(`[CircuitNode] Input socket "${socket.name}" must have input direction.`);
        }
        this.inputs.set(socket.name, socket);
        return this;
    }

    /**
     * Registers an output socket.
     */
    addOutput(socketOrName: Socket | string, dataType?: string): this {
        let socket: Socket;
        if (typeof socketOrName === "string") {
            socket = new Socket(socketOrName, "output", dataType ? { dataType } : {});
        } else {
            socket = socketOrName;
        }
        if (socket.direction !== "output") {
            throw new Error(`[CircuitNode] Output socket "${socket.name}" must have output direction.`);
        }
        this.outputs.set(socket.name, socket);
        return this;
    }

    hasInput(name: string): boolean { return this.inputs.has(name); }
    hasOutput(name: string): boolean { return this.outputs.has(name); }

    getInput<T extends Socket = Socket>(name: string): T | undefined {
        return this.inputs.get(name) as T | undefined;
    }

    getOutput<T extends Socket = Socket>(name: string): T | undefined {
        return this.outputs.get(name) as T | undefined;
    }

    /**
     * Connection validation gate invoked prior to establishing a wire.
     * Enforces socket existence and dataType compatibility when types are declared.
     */
    canConnectInput(
        inSocketName: string,
        outNode: CircuitNode,
        outSocketName: string
    ): boolean {
        const inSocket = this.getInput(inSocketName);
        const outSocket = outNode.getOutput(outSocketName);
        if (!inSocket || !outSocket) return true;

        if (inSocket.dataType !== undefined && outSocket.dataType !== undefined) {
            if (inSocket.dataType === "any" || outSocket.dataType === "any") return true;
            if (inSocket.dataType !== outSocket.dataType) return false;
        }
        return true;
    }

    /**
     * Evaluates the node from one execution's resolved input values.
     * Input and output values belong to the circuit run, not to the node.
     */
    abstract process(
        inputs: Record<string, any>,
        ctx?: ProcessCtx<any>
    ): Record<string, any>;
}

/**
 * Transparent proxy node delegating execution and configuration to a source node.
 */
export class NodeProxy extends CircuitNode {
    readonly sourceNode: CircuitNode;

    constructor(id: string, sourceNode: CircuitNode) {
        super(id, sourceNode.name);
        this.sourceNode = sourceNode;
        for (const socket of sourceNode.inputs.values()) {
            this.addInput(socket.name, {
                dataType: socket.dataType,
                required: socket.required,
            });
        }
        for (const socket of sourceNode.outputs.values()) {
            this.addOutput(socket.name, socket.dataType);
        }
        Object.assign(this.metadata, sourceNode.metadata);
    }

    override canConnectInput(
        inSocketName: string,
        outNode: CircuitNode,
        outSocketName: string
    ): boolean {
        return this.sourceNode.canConnectInput(inSocketName, outNode, outSocketName);
    }

    override process(
        inputs: Record<string, any>,
        ctx?: ProcessCtx<any>
    ): Record<string, any> {
        return this.sourceNode.process(inputs, ctx);
    }

    clone(newId: string): NodeProxy {
        return new NodeProxy(newId, this.sourceNode);
    }
}
