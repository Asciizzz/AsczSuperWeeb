import { ShaderNode } from "./base.js";

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
}
