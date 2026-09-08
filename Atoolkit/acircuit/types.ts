import type { Awire } from "./wire.js";

export type { Awire };

/**
 * Incoming transmission package delivering a computed value alongside its originating wire.
 */
export interface Packet<T = any, TData = any> {
    value: T;
    wire?: Awire<TData>;
}

/**
 * Execution context forwarded to node.process(packets, ctx).
 */
export interface ProcessCtx<TCtx = unknown> {
    /** Optional user context passed through the graph run */
    ctx?: TCtx;
    /** Unique identifier prefix for this node instance. */
    varPrefix: string;
    /** Arbitrary user-defined execution metadata */
    meta?: Record<string, unknown>;
}

export interface RunOptions<TCtx = unknown, TNode = unknown> {
    /** Initial socket overrides: { [nodeId]: { [socketName]: value } } */
    overrides?: Record<string, Record<string, any>>;
    /** Optional user context forwarded to node.process(packets, ctx) */
    ctx?: TCtx;
    /** Arbitrary metadata forwarded to node context */
    meta?: Record<string, unknown>;
    /** Optional callback invoked before a node processes */
    onNodeEnter?: (node: TNode, packets: Record<string, any>) => void;
    /** Optional callback invoked after a node processes */
    onNodeLeave?: (node: TNode, outputs: Record<string, any>) => void;
}

export interface RunResult<TNode = unknown> {
    /** Node ID -> { [socketName]: outputValue } */
    outputs: Map<string, Record<string, any>>;
    /** Nodes traversed in topological execution order */
    orderedNodes: TNode[];
    /** Any non-fatal caught errors */
    errors: Array<{ nodeId: string; error: unknown }>;
}
