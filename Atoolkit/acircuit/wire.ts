/**
 * Directed connection between output socket and input socket in Acircuit graph.
 *
 * - Output sockets support 1-to-N.
 * - Input sockets enforce 1-to-1.
 */
export interface Awire {
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
 * Compares two Awire instances for matching endpoints.
 */
export function wireEquals(a: Awire, b: Awire): boolean {
    return (
        a.outNodeId === b.outNodeId &&
        a.outSocket === b.outSocket &&
        a.inNodeId === b.inNodeId &&
        a.inSocket === b.inSocket
    );
}

/**
 * Formats an Awire as (outNode:outSocket -> inNode:inSocket).
 */
export function formatWire(wire: Awire): string {
    return `(${wire.outNodeId}:${wire.outSocket} -> ${wire.inNodeId}:${wire.inSocket})`;
}
