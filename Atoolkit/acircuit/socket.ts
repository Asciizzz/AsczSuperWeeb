/**
 * Universal base socket in an Acircuit computation graph.
 * Holds the socket name and optional metadata.
 * Subclasses define specialized data, types, or validation constraints.
 */
export class Asocket {
    readonly name: string;
    metadata: Record<string, unknown> = {};

    constructor(name: string) {
        this.name = name;
    }
}
