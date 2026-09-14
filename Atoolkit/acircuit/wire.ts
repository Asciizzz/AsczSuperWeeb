/**
 * Directed connection between output socket and input socket in Circuit graph.
 *
 * - Output sockets support 1-to-N fan-out.
 * - Input sockets enforce 1-to-1 connection.
 */
export interface Wire {
    readonly outNodeId: string;
    readonly outSocket: string;
    readonly inNodeId: string;
    readonly inSocket: string;
}

/**
 * Returns the lookup key for a socket endpoint.
 */
export function inSocketKey(nodeId: string, socketName: string): string {
    return `${nodeId}:${socketName}`;
}

export const outSocketKey = inSocketKey;

/**
 * Compares two Wire instances for matching endpoints.
 */
export function wireEquals(a: Wire, b: Wire): boolean {
    return (
        a.outNodeId === b.outNodeId &&
        a.outSocket === b.outSocket &&
        a.inNodeId === b.inNodeId &&
        a.inSocket === b.inSocket
    );
}

/**
 * Formats a Wire as (outNode:outSocket -> inNode:inSocket).
 */
export function formatWire(wire: Wire): string {
    return `(${wire.outNodeId}:${wire.outSocket} -> ${wire.inNodeId}:${wire.inSocket})`;
}
