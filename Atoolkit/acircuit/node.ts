import { Asocket } from "./socket.js";
import type { ProcessCtx } from "./types.js";

/**
 * Computational unit in an Acircuit computation graph with input and output sockets.
 */
export abstract class Acnode {
    readonly id: string;
    readonly name: string;
    readonly inputs = new Map<string, Asocket>();
    readonly outputs = new Map<string, Asocket>();

    /**
     * Optional user metadata (UI coordinates, color, category, etc.).
     */
    metadata: Record<string, unknown> = {};

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    addInput(socketOrName: Asocket | string): this {
        const socket = typeof socketOrName === "string" ? new Asocket(socketOrName) : socketOrName;
        this.inputs.set(socket.name, socket);
        return this;
    }

    addOutput(socketOrName: Asocket | string): this {
        const socket = typeof socketOrName === "string" ? new Asocket(socketOrName) : socketOrName;
        this.outputs.set(socket.name, socket);
        return this;
    }

    hasInput(name: string): boolean {
        return this.inputs.has(name);
    }

    hasOutput(name: string): boolean {
        return this.outputs.has(name);
    }

    getInput<T extends Asocket = Asocket>(name: string): T | undefined {
        return this.inputs.get(name) as T | undefined;
    }

    getOutput<T extends Asocket = Asocket>(name: string): T | undefined {
        return this.outputs.get(name) as T | undefined;
    }

    /**
     * Check whether an input socket accepts multiple incoming wires.
     * Defaults to false (single writer per input socket).
     * Subclasses can override this to return true for multi-wire fan-in.
     */
    allowMultipleInput(socketName: string): boolean {
        return false;
    }

    /**
     * Hook to validate incoming connections before wiring.
     * Subclasses can inspect the source outNode, outSocket, and wire data to permit or reject wires.
     */
    canConnectInput(
        inSocketName: string,
        outNode: Acnode,
        outSocketName: string,
        data?: any
    ): boolean {
        return true;
    }

    /**
     * Primary circuit processing method.
     * Receives incoming transmission packets (value + wire) and execution context.
     * Returns an object mapping output socket names to computed values.
     */
    process?(
        packets: Record<string, any>,
        ctx?: ProcessCtx<any>
    ): Record<string, any> | void;
}

export { Acnode as AcircuitNode };