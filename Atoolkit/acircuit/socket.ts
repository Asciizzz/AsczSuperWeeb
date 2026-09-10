/**
 * Communication endpoint direction.
 */
export type SocketDirection = "input" | "output";

/**
 * Communication endpoint on an Acnode.
 * Identifies an input or output endpoint on a node.
 */
export class Asocket {
    readonly name: string;
    readonly direction: SocketDirection;

    constructor(name: string, direction: SocketDirection = "input") {
        this.name = name;
        this.direction = direction;
    }

}
