import { ShaderNode, type NodeCompileContext } from "./base.js";

/**
 * Output Node: The terminal sink node of a surface shader graph.
 * Pure terminal sink with zero uniform parameter overhead.
 * Inputs: "baseColor" (vec4), "alpha" (float), "emissive" (vec3).
 */
export class OutputNode extends ShaderNode {
    constructor(id = "output") {
        super(id, "Output", {
            category: "output",
            displayName: "Surface Output",
        });

        this.addInput({ name: "baseColor", type: "vec4" });
        this.addInput({ name: "alpha", type: "float" });
        this.addInput({ name: "emissive", type: "vec3" });
    }

    generateWGSL(ctx: NodeCompileContext): string {
        const baseColorExpr = ctx.inputs["baseColor"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const emissiveExpr = ctx.inputs["emissive"];
        const alphaExpr = ctx.inputs["alpha"];

        let code = `    finalSurfaceColor = ${baseColorExpr};`;

        if (alphaExpr) {
            code += `\n    finalSurfaceColor.a = finalSurfaceColor.a * (${alphaExpr});`;
        }

        if (emissiveExpr) {
            code += `\n    finalSurfaceColor = vec4<f32>(finalSurfaceColor.rgb + (${emissiveExpr}), finalSurfaceColor.a);`;
        }

        return code;
    }
}
