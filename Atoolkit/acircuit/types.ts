import type { Wire } from "./wire.js";
import type { SocketDirection } from "./socket.js";
import type { CircuitNode } from "./node.js";

export type { Wire };

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
    onWireTransmit?: (wire: Wire, value: any) => void;
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

/**
 * Classification of structural graph validation issue.
 */
export type CircuitIssueType = "cycle" | "missing_input" | "type_mismatch" | "isolated_node";

/**
 * Diagnostic descriptor representing a validation defect.
 */
export interface CircuitIssue {
    type: CircuitIssueType;
    message: string;
    nodeId?: string;
    socketName?: string;
    wire?: Wire;
}

/**
 * Result of static circuit validation pass.
 */
export interface CircuitValidationResult {
    valid: boolean;
    issues: CircuitIssue[];
}

/**
 * Serialized representation of a socket endpoint.
 */
export interface SerializedSocket {
    name: string;
    direction: SocketDirection;
    dataType?: string;
    required?: boolean;
}

/**
 * Serialized representation of a circuit node.
 */
export interface SerializedNode {
    id: string;
    name: string;
    type?: string;
    inputs: SerializedSocket[];
    outputs: SerializedSocket[];
    metadata?: Record<string, any>;
}

/**
 * Serialized representation of an entire circuit topology.
 */
export interface SerializedCircuit {
    label: string;
    nodes: SerializedNode[];
    wires: Wire[];
}

/**
 * Factory callback instantiating a CircuitNode from serialized data.
 */
export type NodeFactory = (serialized: SerializedNode) => CircuitNode;
