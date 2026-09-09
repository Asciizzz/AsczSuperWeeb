import { Asocket } from "./socket.js";
import type { ProcessCtx } from "./types.js";

/**
 * Stateless computational unit with 1-to-1 input sockets and 1-to-N output sockets.
 */
export abstract class Acnode {
    readonly id: string;
    readonly name: string;
    readonly inputs = new Map<string, Asocket>();
    readonly outputs = new Map<string, Asocket>();

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    /**
     * Registers an input socket.
     */
    addInput(socketOrName: Asocket | string): this {
        const socket = typeof socketOrName === "string" ? new Asocket(socketOrName, "input") : socketOrName;
        this.inputs.set(socket.name, socket);
        return this;
    }

    /**
     * Registers an output socket.
     */
    addOutput(socketOrName: Asocket | string): this {
        const socket = typeof socketOrName === "string" ? new Asocket(socketOrName, "output") : socketOrName;
        this.outputs.set(socket.name, socket);
        return this;
    }

    hasInput(name: string): boolean { return this.inputs.has(name); }
    hasOutput(name: string): boolean { return this.outputs.has(name); }

    getInput<T extends Asocket = Asocket>(name: string): T | undefined {
        return this.inputs.get(name) as T | undefined;
    }

    getOutput<T extends Asocket = Asocket>(name: string): T | undefined {
        return this.outputs.get(name) as T | undefined;
    }

    /**
     * Connection validation gate invoked prior to establishing a wire.
     */
    canConnectInput(
        inSocketName: string,
        outNode: Acnode,
        outSocketName: string
    ): boolean {
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

export { Acnode as AcircuitNode, Acnode as Adfnode };
