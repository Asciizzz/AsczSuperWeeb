import { CircuitNode } from "./node.js";
import type { Circuit } from "./circuit.js";
import type { ProcessCtx } from "./types.js";

export interface InputSocketMapping {
    outerSocket: string;
    innerNodeId: string;
    innerSocket: string;
}

export interface OutputSocketMapping {
    outerSocket: string;
    innerNodeId: string;
    innerSocket: string;
}

/**
 * Composite node encapsulating an inner Circuit graph.
 */
export class Subcircuit extends CircuitNode {
    readonly innerCircuit: Circuit;
    readonly inputMappings = new Map<string, InputSocketMapping>();
    readonly outputMappings = new Map<string, OutputSocketMapping>();

    constructor(id: string, name: string, innerCircuit: Circuit) {
        super(id, name);
        this.innerCircuit = innerCircuit;
    }

    /**
     * Maps an external input socket to an internal node's input socket.
     */
    mapInput(
        outerSocketName: string,
        innerNodeId: string,
        innerSocketName: string,
        dataType?: string
    ): this {
        const innerNode = this.innerCircuit.getNode(innerNodeId);
        if (!innerNode) {
            throw new Error(`[Subcircuit] Inner node "${innerNodeId}" not found in subcircuit.`);
        }
        const innerSocket = innerNode.getInput(innerSocketName);
        if (!innerSocket) {
            throw new Error(`[Subcircuit] Inner input socket "${innerNodeId}:${innerSocketName}" not found.`);
        }
        const effectiveType = dataType ?? innerSocket.dataType;
        this.addInput(outerSocketName, effectiveType);
        this.inputMappings.set(outerSocketName, {
            outerSocket: outerSocketName,
            innerNodeId,
            innerSocket: innerSocketName,
        });
        return this;
    }

    /**
     * Maps an internal node's output socket to an external output socket.
     */
    mapOutput(
        outerSocketName: string,
        innerNodeId: string,
        innerSocketName: string,
        dataType?: string
    ): this {
        const innerNode = this.innerCircuit.getNode(innerNodeId);
        if (!innerNode) {
            throw new Error(`[Subcircuit] Inner node "${innerNodeId}" not found in subcircuit.`);
        }
        const innerSocket = innerNode.getOutput(innerSocketName);
        if (!innerSocket) {
            throw new Error(`[Subcircuit] Inner output socket "${innerNodeId}:${innerSocketName}" not found.`);
        }
        const effectiveType = dataType ?? innerSocket.dataType;
        this.addOutput(outerSocketName, effectiveType);
        this.outputMappings.set(outerSocketName, {
            outerSocket: outerSocketName,
            innerNodeId,
            innerSocket: innerSocketName,
        });
        return this;
    }

    override process(
        inputs: Record<string, any>,
        ctx?: ProcessCtx<any>
    ): Record<string, any> {
        const overrides: Record<string, Record<string, any>> = {};

        for (const [outerName, mapping] of this.inputMappings) {
            const val = inputs[outerName];
            if (val !== undefined) {
                let nodeOverrides = overrides[mapping.innerNodeId];
                if (!nodeOverrides) {
                    nodeOverrides = {};
                    overrides[mapping.innerNodeId] = nodeOverrides;
                }
                nodeOverrides[mapping.innerSocket] = val;
            }
        }

        const runResult = this.innerCircuit.run({
            overrides,
            ctx: ctx?.ctx,
        });

        if (runResult.errors.length > 0) {
            const first = runResult.errors[0];
            throw first.error instanceof Error
                ? first.error
                : new Error(`[Subcircuit] Inner execution failed on node "${first.nodeId}": ${String(first.error)}`);
        }

        const outputs: Record<string, any> = {};
        for (const [outerName, mapping] of this.outputMappings) {
            const nodeOuts = runResult.outputs.get(mapping.innerNodeId);
            if (nodeOuts && nodeOuts[mapping.innerSocket] !== undefined) {
                outputs[outerName] = nodeOuts[mapping.innerSocket];
            }
        }

        return outputs;
    }
}
