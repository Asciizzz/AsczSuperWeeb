import { ShaderNode, type NodeCompileContext } from "./base.js";
import { type ShaderParamProvider } from "./params.js";
import { Texture } from "../../texture.js";

export interface ColorNodeOptions {
    color?: number[];
    isParam?: boolean;
    paramName?: string;
}

/**
 * Color Node: Emits a vec4 color constant or parameter uniform.
 * Outputs: "color" (vec4), "rgb" (vec3), "alpha" (float).
 */
export class ColorNode extends ShaderNode implements ShaderParamProvider {
    defaultColor: number[];
    isParam: boolean;
    paramName?: string;

    constructor(
        id: string,
        colorOrOptions?: number[] | ColorNodeOptions,
        isParam = false,
        paramName?: string
    ) {
        let col = [1, 1, 1, 1];
        let paramFlag = isParam;
        let pName = paramName;

        if (Array.isArray(colorOrOptions)) {
            col = [...colorOrOptions];
        } else if (colorOrOptions && typeof colorOrOptions === "object") {
            col = colorOrOptions.color ? [...colorOrOptions.color] : [1, 1, 1, 1];
            paramFlag = colorOrOptions.isParam ?? (colorOrOptions.paramName !== undefined);
            pName = colorOrOptions.paramName;
        }

        super(id, "Color", {
            category: "color",
            displayName: pName ? `Color: ${pName}` : "Color / Tint",
        });

        this.defaultColor = col;
        this.isParam = paramFlag;
        this.paramName = pName ?? (paramFlag ? id : undefined);

        this.addOutput({ name: "color", type: "vec4" });
        this.addOutput({ name: "rgb", type: "vec3" });
        this.addOutput({ name: "alpha", type: "float" });
    }

    get defaultValue(): number[] {
        return this.defaultColor;
    }

    set defaultValue(val: number[]) {
        this.defaultColor = val;
    }

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        if (this.isParam && this.paramName) {
            return `
    let ${p}_color: vec4<f32> = ${ctx.uniformVarName}.${this.paramName};
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
        }

        const [r, g, b, a] = this.defaultColor;
        return `
    let ${p}_color: vec4<f32> = vec4<f32>(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}, ${(a ?? 1.0).toFixed(4)});
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }
}

/**
 * Dedicated Constant Color Node:
 * Emits an inline compile-time vec4 literal with zero uniform buffer overhead.
 */
export class ConstColorNode extends ColorNode {
    constructor(id: string, color: number[] = [1, 1, 1, 1]) {
        super(id, { color, isParam: false });
        this.displayName = "Constant Color";
    }
}

export interface TextureSampleOptions {
    texture?: Texture | null;
    isParam?: boolean;
    paramName?: string;
}

/**
 * Texture Sample Node: Samples a 2D texture at specified UV coordinates to produce surface color.
 * Inputs: "uv" (vec2, defaults to vertex in.uv).
 * Outputs: "color" (vec4), "rgb" (vec3), "alpha" (float).
 */
export class TextureSampleNode extends ShaderNode implements ShaderParamProvider {
    defaultTexture: Texture | null;
    textureIndex = 0; // Assigned during graph compilation
    isParam: boolean;
    paramName?: string;

    constructor(
        id: string,
        textureOrOptions?: Texture | null | TextureSampleOptions,
        isParam = false,
        paramName?: string
    ) {
        let tex: Texture | null = null;
        let paramFlag = isParam;
        let pName = paramName;

        if (textureOrOptions instanceof Texture || textureOrOptions === null) {
            tex = textureOrOptions;
        } else if (textureOrOptions && typeof textureOrOptions === "object") {
            tex = textureOrOptions.texture ?? null;
            paramFlag = textureOrOptions.isParam ?? (textureOrOptions.paramName !== undefined);
            pName = textureOrOptions.paramName;
        }

        super(id, "TextureSample", {
            category: "color",
            displayName: pName ? `Texture: ${pName}` : "Texture Sample",
        });

        this.defaultTexture = tex;
        this.isParam = paramFlag;
        this.paramName = pName ?? (paramFlag ? id : undefined);

        this.addInput({ name: "uv", type: "vec2" });
        this.addOutput({ name: "color", type: "vec4" });
        this.addOutput({ name: "rgb", type: "vec3" });
        this.addOutput({ name: "alpha", type: "float" });
    }

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        const uvExpr = ctx.inputs["uv"] ?? "in.uv";
        const texBinding = `t_tex_${this.textureIndex}`;
        const sampBinding = `s_tex_${this.textureIndex}`;

        return `
    let ${p}_color: vec4<f32> = textureSample(${texBinding}, ${sampBinding}, ${uvExpr});
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }
}

export interface BlendNodeOptions {
    mode?: number;
    factor?: number;
}

/**
 * Blend Node / Color Mix Node:
 * Combines two color/texture streams with selectable arithmetic or interpolation modes:
 * - 0: Multiply (a * b)
 * - 1: Add (clamp(a + b, 0.0, 1.0))
 * - 2: Subtract (clamp(a - b, 0.0, 1.0))
 * - 3: Mix / Linear Interpolation (mix(a, b, factor))
 * - 4: A Only / Texture Solo (a)
 * - 5: B Only / Tint Solo (b)
 * - 6: Divide (clamp(a / max(b, 0.0001), 0.0, 1.0))
 * 
 * Pure computation unit with zero uniform parameter overhead.
 * Inputs: "a" (vec4), "b" (vec4), "mode" (float), "factor" (float).
 * Output: "out" (vec4).
 */
export class BlendNode extends ShaderNode {
    defaultMode: number;
    defaultFactor: number;

    constructor(
        id: string,
        optionsOrMode: BlendNodeOptions | number = 0,
        defaultFactor = 0.5
    ) {
        let mode = 0;
        let factor = 0.5;

        if (typeof optionsOrMode === "number") {
            mode = optionsOrMode;
            factor = defaultFactor;
        } else if (optionsOrMode && typeof optionsOrMode === "object") {
            mode = optionsOrMode.mode ?? 0;
            factor = optionsOrMode.factor ?? 0.5;
        }

        super(id, "Blend", {
            category: "color",
            displayName: "Mix / Blend",
        });

        this.defaultMode = mode;
        this.defaultFactor = factor;

        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addInput({ name: "mode", type: "float" });
        this.addInput({ name: "factor", type: "float" });
        this.addOutput({ name: "out", type: "vec4" });
    }

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        const inA = ctx.inputs["a"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const inB = ctx.inputs["b"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const inMode = ctx.inputs["mode"] ?? `${this.defaultMode.toFixed(1)}`;
        const inFactor = ctx.inputs["factor"] ?? `${this.defaultFactor.toFixed(4)}`;

        return `
    var ${p}_out: vec4<f32>;
    let ${p}_m = i32(${inMode} + 0.5);
    if (${p}_m == 0) {
        ${p}_out = ${inA} * ${inB};
    } else if (${p}_m == 1) {
        ${p}_out = clamp(${inA} + ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
    } else if (${p}_m == 2) {
        ${p}_out = clamp(${inA} - ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
    } else if (${p}_m == 3) {
        ${p}_out = mix(${inA}, ${inB}, ${inFactor});
    } else if (${p}_m == 4) {
        ${p}_out = ${inA};
    } else if (${p}_m == 5) {
        ${p}_out = ${inB};
    } else {
        ${p}_out = clamp(${inA} / max(${inB}, vec4<f32>(0.0001, 0.0001, 0.0001, 0.0001)), vec4<f32>(0.0), vec4<f32>(1.0));
    }`;
    }
}

export { BlendNode as ColorMixNode };
