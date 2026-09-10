import type { Awire } from "./wire.js";

export type { Awire };

/**
 * Execution context passed to node.process(inputs, ctx).
 */
export interface ProcessCtx<TCtx = unknown> {
    /** User context forwarded through execution */
    ctx?: TCtx;
}

/**
 * Configuration for topological runs.
 */
export interface RunOptions<TCtx = unknown, TNode = unknown> {
    /** User context forwarded to node.process(inputs, ctx) */
    ctx?: TCtx;
    /** Initial input socket values: { [nodeId]: { [socketName]: value } } */
    overrides?: Record<string, Record<string, any>>;
    /** Callback invoked before node execution */
    onNodeEnter?: (node: TNode, inputs: Record<string, any>) => void;
    /** Callback invoked after node execution */
    onNodeLeave?: (node: TNode, outputs: Record<string, any>) => void;
    /** Callback invoked on wire value resolution */
    onWireTransmit?: (wire: Awire, value: any) => void;
}

/**
 * Result of a circuit execution run.
 */
export interface RunResult<TNode = unknown> {
    /** Mapping of node ID to computed output socket records */
    outputs: Map<string, Record<string, any>>;
    /** Nodes executed in topological order */
    executedNodes: TNode[];
    /** Caught execution errors */
    errors: Array<{ nodeId: string; error: unknown }>;
}
