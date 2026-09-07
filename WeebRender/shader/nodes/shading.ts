import { ShaderNode, type NodeCompileContext } from "./base.js";

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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        const inColor = ctx.inputs["color"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const inAmbient = ctx.inputs["ambient"] ?? `${this.defaultAmbient.toFixed(4)}`;
        const inDiffuse = ctx.inputs["diffuse"] ?? `${this.defaultDiffuse.toFixed(4)}`;
        const [lx, ly, lz] = this.defaultLightDir;
        const inLightDir =
            ctx.inputs["lightDir"] ??
            `normalize(vec3<f32>(${lx.toFixed(4)}, ${ly.toFixed(4)}, ${lz.toFixed(4)}))`;

        return `
            let ${p}_inColor = ${inColor};
            let ${p}_normLen = length(in.normal);
            let ${p}_N = select(vec3<f32>(0.0, 1.0, 0.0), in.normal / max(${p}_normLen, 0.0001), ${p}_normLen > 0.0001);
            let ${p}_keyDir = ${inLightDir};
            let ${p}_keyDiff = max(dot(${p}_N, ${p}_keyDir), 0.0);
            let ${p}_fillDir = normalize(vec3<f32>(-0.6, 0.2, -0.4));
            let ${p}_fillDiff = max(dot(${p}_N, ${p}_fillDir), 0.0) * 0.35;
            let ${p}_intensity = ${inAmbient} + ${p}_keyDiff * ${inDiffuse} + ${p}_fillDiff;
            let ${p}_out = vec4<f32>(${p}_inColor.rgb * ${p}_intensity, ${p}_inColor.a);
        `;
    }
}
