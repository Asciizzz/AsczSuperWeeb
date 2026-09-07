import { Adfnode, Asocket, type Packet, type ProcessCtx } from "../../../Atoolkit/adataflow/index.js";
import { ShaderSocket, type SocketType } from "../types.js";
import type { Texture } from "../../texture.js";

export type NodeCategory = "input" | "math" | "color" | "shading" | "output";

export interface NodeCompileContext {
    inputs: Record<string, string>; // Maps input socket name to incoming WGSL expression
    varPrefix: string;              // Unique prefix for this node's emitted variables
    uniformVarName: string;         // Name of the uniform struct (e.g. uMaterial)
}

export interface ShaderProcessCtx {
    statements: string[];
    uniformVarName?: string;
}

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
export abstract class ShaderNode extends Adfnode {
    displayName: string;
    category: NodeCategory;

    constructor(id: string, name: string, meta?: ShaderNodeMetadata) {
        super(id, name);
        this.displayName = meta?.displayName ?? name;
        this.category = meta?.category ?? "math";
    }

    override addInput(socketOrName: Asocket | string | { name: string; type: SocketType }): this {
        if (typeof socketOrName === "object" && !(socketOrName instanceof Asocket)) {
            return super.addInput(new ShaderSocket(socketOrName.name, socketOrName.type));
        }
        return super.addInput(socketOrName);
    }

    override addOutput(socketOrName: Asocket | string | { name: string; type: SocketType }): this {
        if (typeof socketOrName === "object" && !(socketOrName instanceof Asocket)) {
            return super.addOutput(new ShaderSocket(socketOrName.name, socketOrName.type));
        }
        return super.addOutput(socketOrName);
    }

    /**
     * Emits WGSL code lines for this node into the fragment shader body.
     */
    abstract generateWGSL(ctx: NodeCompileContext): string;

    override canConnectInput(
        inSocketName: string,
        outNode: Adfnode,
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
     * Executes dataflow evaluation: collects string input expressions from incoming packets,
     * calls generateWGSL, appends statement to context, and passes variable names downstream.
     */
    override process(
        packets: Record<string, Packet<string | number | number[] | Texture | ShaderOutputValue> | undefined>,
        ctx?: ProcessCtx<ShaderProcessCtx>
    ): Record<string, any> {
        const varPrefix = ctx?.varPrefix ?? `node_${this.id}`;
        const uniformVarName = ctx?.ctx?.uniformVarName ?? "uMaterial";

        const stringInputs: Record<string, string> = {};
        for (const [key, packet] of Object.entries(packets)) {
            const val = packet?.value;
            if (val === undefined || val === null) continue;

            let expr = "";
            let valType: SocketType | undefined;

            if (val instanceof ShaderOutputValue) {
                expr = val.expr;
                valType = val.type;
            } else if (typeof val === "object" && "expr" in (val as any) && "type" in (val as any)) {
                expr = (val as any).expr;
                valType = (val as any).type;
            } else if (typeof val === "string") {
                expr = val;
            } else if (typeof val === "number") {
                expr = val.toFixed(4);
                valType = "float";
            } else if (Array.isArray(val)) {
                if (val.length === 4) {
                    expr = `vec4<f32>(${val.map((n) => n.toFixed(4)).join(", ")})`;
                    valType = "vec4";
                } else if (val.length === 3) {
                    expr = `vec3<f32>(${val.map((n) => n.toFixed(4)).join(", ")})`;
                    valType = "vec3";
                } else if (val.length === 2) {
                    expr = `vec2<f32>(${val.map((n) => n.toFixed(4)).join(", ")})`;
                    valType = "vec2";
                }
            }

            // Automatic dimension swizzling and type adaptation
            const targetSocket = this.getInput(key) as ShaderSocket | undefined;
            if (targetSocket && valType && targetSocket.type !== valType) {
                if (targetSocket.type === "float") {
                    if (valType === "vec4" || valType === "vec3" || valType === "vec2") {
                        expr = `(${expr}).r`;
                    }
                } else if (targetSocket.type === "vec4") {
                    if (valType === "float") {
                        expr = `vec4<f32>(${expr}, ${expr}, ${expr}, 1.0)`;
                    } else if (valType === "vec3") {
                        expr = `vec4<f32>(${expr}, 1.0)`;
                    } else if (valType === "vec2") {
                        expr = `vec4<f32>(${expr}, 0.0, 1.0)`;
                    }
                } else if (targetSocket.type === "vec3") {
                    if (valType === "float") {
                        expr = `vec3<f32>(${expr}, ${expr}, ${expr})`;
                    } else if (valType === "vec4") {
                        expr = `(${expr}).rgb`;
                    } else if (valType === "vec2") {
                        expr = `vec3<f32>(${expr}, 0.0)`;
                    }
                } else if (targetSocket.type === "vec2") {
                    if (valType === "vec4" || valType === "vec3") {
                        expr = `(${expr}).xy`;
                    } else if (valType === "float") {
                        expr = `vec2<f32>(${expr}, ${expr})`;
                    }
                }
            }

            stringInputs[key] = expr;
        }

        const code = this.generateWGSL({
            inputs: stringInputs,
            varPrefix,
            uniformVarName,
        });

        if (code && code.trim().length > 0 && ctx?.ctx?.statements) {
            ctx.ctx.statements.push(code);
        }

        const outputs: Record<string, any> = {};
        for (const [name, socket] of this.outputs) {
            const sType = (socket as ShaderSocket)?.type ?? "vec4";
            outputs[name] = new ShaderOutputValue(`${varPrefix}_${name}`, sType);
        }
        return outputs;
    }
}

/**
 * Encapsulates an emitted shader variable name and its socket type,
 * allowing downstream nodes to automatically swizzle or cast inputs.
 */
export class ShaderOutputValue {
    constructor(
        public expr: string,
        public type: SocketType
    ) {}

    toString(): string {
        return this.expr;
    }
}
