import { ShaderNode } from "./base.js";

export interface BasicShadingOptions {
    ambient?: number;
    diffuse?: number;
    lightDir?: [number, number, number];
}

/**
 * Basic Shading Node:
 * Receives surface color through a single 1-wire input socket ("color"), applies directional
 * and ambient lighting calculations based on the interpolated vertex normal, and outputs
 * the shaded color ("out").
 * 
 * Pure computation unit with zero uniform parameter overhead.
 * Connect "out" to OutputNode's "baseColor" to produce shaded surfaces, or bypass it to
 * keep colors unshaded.
 */
export class BasicShadingNode extends ShaderNode {
    defaultAmbient: number;
    defaultDiffuse: number;
    defaultLightDir: [number, number, number];

    constructor(
        id: string,
        optionsOrAmbient: BasicShadingOptions | number = 0.28,
        diffuse = 0.72,
        lightDir: [number, number, number] = [0.5, 0.8, 0.6]
    ) {
        let amb = 0.28;
        let diff = 0.72;
        let lDir: [number, number, number] = [0.5, 0.8, 0.6];

        if (typeof optionsOrAmbient === "number") {
            amb = optionsOrAmbient;
            diff = diffuse;
            lDir = lightDir;
        } else if (optionsOrAmbient && typeof optionsOrAmbient === "object") {
            amb = optionsOrAmbient.ambient ?? 0.28;
            diff = optionsOrAmbient.diffuse ?? 0.72;
            lDir = optionsOrAmbient.lightDir ?? [0.5, 0.8, 0.6];
        }

        super(id, "BasicShading", {
            category: "shading",
            displayName: "Basic Shading",
        });

        this.defaultAmbient = amb;
        this.defaultDiffuse = diff;
        this.defaultLightDir = lDir;

        // 1-wire primary color input socket
        this.addInput({ name: "color", type: "vec4" });

        // Lighting input sockets
        this.addInput({ name: "ambient", type: "float" });
        this.addInput({ name: "diffuse", type: "float" });
        this.addInput({ name: "lightDir", type: "vec3" });

        // Shaded result output socket
        this.addOutput({ name: "out", type: "vec4" });
    }
}
