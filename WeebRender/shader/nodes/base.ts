import { Acnode, Asocket } from "../../../Atoolkit/acircuit/index.js";
import { ShaderSocket, type SocketType } from "../types.js";

export type NodeCategory = "input" | "math" | "color" | "shading" | "output";

export interface ShaderNodeMetadata {
    displayName?: string;
    category?: NodeCategory;
}

/**
 * Base abstract class for all shader graph nodes.
 * Represents a pure computation, source, or sink block in the shader compilation DAG.
 * 
 * Note: ShaderNode does NOT hold GPU uniform parameters directly. Parameter-providing
 * nodes implement ShaderParamProvider to isolate GPU memory layout from computation.
 */
export abstract class ShaderNode extends Acnode {
    displayName: string;
    category: NodeCategory;
    metadata: Record<string, unknown> = {};

    constructor(id: string, name: string, meta?: ShaderNodeMetadata) {
        super(id, name);
        this.displayName = meta?.displayName ?? name;
        this.category = meta?.category ?? "math";
    }

    override addInput(socketOrName: Asocket | string | { name: string; type: SocketType }): this {
        if (typeof socketOrName === "object" && !(socketOrName instanceof Asocket)) {
            return super.addInput(new ShaderSocket(socketOrName.name, socketOrName.type, "input"));
        }
        return super.addInput(socketOrName);
    }

    override addOutput(socketOrName: Asocket | string | { name: string; type: SocketType }): this {
        if (typeof socketOrName === "object" && !(socketOrName instanceof Asocket)) {
            return super.addOutput(new ShaderSocket(socketOrName.name, socketOrName.type, "output"));
        }
        return super.addOutput(socketOrName);
    }

    override canConnectInput(
        inSocketName: string,
        outNode: Acnode,
        outSocketName: string
    ): boolean {
        const inSocket = this.getInput(inSocketName) as ShaderSocket | undefined;
        const outSocket = outNode.getOutput(outSocketName) as ShaderSocket | undefined;
        if (inSocket && outSocket && inSocket.type && outSocket.type) {
            // Textures only connect to textures, numerics only to numerics
            if (inSocket.type === "texture2d" || outSocket.type === "texture2d") {
                return inSocket.type === outSocket.type;
            }
        }
        return true;
    }

    /**
     * Shader nodes describe compiler expressions and do not execute as runtime values.
     */
    override process(): Record<string, any> {
        return {};
    }
}
