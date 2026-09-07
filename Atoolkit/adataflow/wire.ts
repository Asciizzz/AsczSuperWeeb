/**
 * Directed connection between two sockets in an Adataflow computation graph.
 * Pure data structure representing graph topology: (outNode, outSocket) -> (inNode, inSocket).
 */
export interface Awire<TData = any> {
    outNodeId: string;
    outSocket: string;
    inNodeId: string;
    inSocket: string;
    data?: TData;
}
