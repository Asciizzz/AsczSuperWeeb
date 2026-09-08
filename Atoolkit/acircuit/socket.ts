/**
 * Universal base socket in an Acircuit computation graph.
 * Pure inheritance base holding the socket name and optional metadata.
 * Subclasses can populate domain-specific data, types, or behaviors.
 */
export class Asocket {
    readonly name: string;
    metadata: Record<string, unknown> = {};

    constructor(name: string) {
        this.name = name;
    }
}
