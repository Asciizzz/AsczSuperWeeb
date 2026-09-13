import { Acnode, Asocket } from "../../../Atoolkit/acircuit/index.js";
import { ShaderSocket, type SocketType } from "./types.js";
import type { GpuTexture } from "../../gpu/gtexture.js";

export type NodeCategory = "input" | "math" | "color" | "shading" | "output";

export interface ShaderNodeMetadata {
    displayName?: string;
    category?: NodeCategory;
}

/**
 * Base abstract class for all shader circuit nodes.
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
            if (inSocket.type === "texture2d" || outSocket.type === "texture2d") {
                return inSocket.type === outSocket.type;
            }
        }
        return true;
    }

    override process(): Record<string, any> {
        return {};
    }
}

export interface ShaderParamProvider {
    readonly isParam: boolean;
    readonly paramName?: string;
}

export function isShaderParam(node: unknown): node is ShaderParamProvider {
    return (
        typeof node === "object" &&
        node !== null &&
        (node as ShaderParamProvider).isParam === true
    );
}

export interface ParamVec4Options {
    defaultValue?: number[];
    displayName?: string;
}

export class ParamVec4Node extends ShaderNode implements ShaderParamProvider {
    readonly isParam = true;
    paramName: string;
    defaultValue: number[];

    constructor(
        id: string,
        paramName: string,
        defaultValueOrOptions?: number[] | ParamVec4Options
    ) {
        let def = [1, 1, 1, 1];
        let dName = `Param: ${paramName}`;

        if (Array.isArray(defaultValueOrOptions)) {
            def = [...defaultValueOrOptions];
        } else if (defaultValueOrOptions && typeof defaultValueOrOptions === "object") {
            def = defaultValueOrOptions.defaultValue
                ? [...defaultValueOrOptions.defaultValue]
                : [1, 1, 1, 1];
            dName = defaultValueOrOptions.displayName ?? dName;
        }

        super(id, "ParamVec4", {
            category: "input",
            displayName: dName,
        });

        this.paramName = paramName;
        this.defaultValue = def;

        this.addOutput({ name: "color", type: "vec4" });
        this.addOutput({ name: "rgb", type: "vec3" });
        this.addOutput({ name: "alpha", type: "float" });
    }

    get defaultColor(): number[] {
        return this.defaultValue;
    }

    set defaultColor(val: number[]) {
        this.defaultValue = val;
    }
}

export interface ParamFloatOptions {
    defaultValue?: number;
    displayName?: string;
}

export class ParamFloatNode extends ShaderNode implements ShaderParamProvider {
    readonly isParam = true;
    paramName: string;
    defaultValue: number;

    constructor(
        id: string,
        paramName: string,
        defaultValueOrOptions?: number | ParamFloatOptions
    ) {
        let def = 0.0;
        let dName = `Param: ${paramName}`;

        if (typeof defaultValueOrOptions === "number") {
            def = defaultValueOrOptions;
        } else if (defaultValueOrOptions && typeof defaultValueOrOptions === "object") {
            def = defaultValueOrOptions.defaultValue ?? 0.0;
            dName = defaultValueOrOptions.displayName ?? dName;
        }

        super(id, "ParamFloat", {
            category: "input",
            displayName: dName,
        });

        this.paramName = paramName;
        this.defaultValue = def;

        this.addOutput({ name: "value", type: "float" });
    }
}

export interface ColorNodeOptions {
    color?: number[];
    isParam?: boolean;
    paramName?: string;
}

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
}

export class ConstColorNode extends ColorNode {
    constructor(id: string, color: number[] = [1, 1, 1, 1]) {
        super(id, { color, isParam: false });
        this.displayName = "Constant Color";
    }
}

export interface TextureSampleOptions {
    texture?: GpuTexture | null;
    isParam?: boolean;
    paramName?: string;
}

export class TextureSampleNode extends ShaderNode implements ShaderParamProvider {
    defaultTexture: GpuTexture | null;
    textureIndex = 0;
    isParam: boolean;
    paramName?: string;

    constructor(
        id: string,
        textureOrOptions?: GpuTexture | null | TextureSampleOptions,
        isParam = false,
        paramName?: string
    ) {
        let tex: GpuTexture | null = null;
        let paramFlag = isParam;
        let pName = paramName;

        if (textureOrOptions && "gpuTexture" in textureOrOptions) {
            tex = textureOrOptions as GpuTexture;
        } else if (textureOrOptions && typeof textureOrOptions === "object") {
            tex = (textureOrOptions as TextureSampleOptions).texture ?? null;
            paramFlag = (textureOrOptions as TextureSampleOptions).isParam ?? ((textureOrOptions as TextureSampleOptions).paramName !== undefined);
            pName = (textureOrOptions as TextureSampleOptions).paramName;
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
}

export interface BlendNodeOptions {
    mode?: number;
    factor?: number;
}

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
}

export { BlendNode as ColorMixNode };

export interface FloatNodeOptions {
    value?: number;
    isParam?: boolean;
    paramName?: string;
}

export class FloatNode extends ShaderNode implements ShaderParamProvider {
    defaultValue: number;
    isParam: boolean;
    paramName?: string;

    constructor(
        id: string,
        valueOrOptions?: number | FloatNodeOptions,
        isParam = false,
        paramName?: string
    ) {
        let val = 0.0;
        let paramFlag = isParam;
        let pName = paramName;

        if (typeof valueOrOptions === "number") {
            val = valueOrOptions;
        } else if (valueOrOptions && typeof valueOrOptions === "object") {
            val = valueOrOptions.value ?? 0.0;
            paramFlag = valueOrOptions.isParam ?? (valueOrOptions.paramName !== undefined);
            pName = valueOrOptions.paramName;
        }

        super(id, "Float", {
            category: "math",
            displayName: pName ? `Float: ${pName}` : "Float Value",
        });

        this.defaultValue = val;
        this.isParam = paramFlag;
        this.paramName = pName ?? (paramFlag ? id : undefined);

        this.addOutput({ name: "value", type: "float" });
    }
}

export class ConstFloatNode extends FloatNode {
    constructor(id: string, value = 0.0) {
        super(id, { value, isParam: false });
        this.displayName = "Constant Float";
    }
}

export type MathOperation = "add" | "multiply" | "subtract" | "divide";

export interface MathNodeOptions {
    operation?: MathOperation;
}

export class MathNode extends ShaderNode {
    operation: MathOperation;

    constructor(
        id: string,
        optionsOrOp: MathNodeOptions | MathOperation = "multiply"
    ) {
        const op =
            typeof optionsOrOp === "string"
                ? optionsOrOp
                : (optionsOrOp?.operation ?? "multiply");

        super(id, "Math", {
            category: "math",
            displayName: `Math (${op})`,
        });

        this.operation = op;

        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

export interface MixNodeOptions {
    defaultFactor?: number;
}

export class MixNode extends ShaderNode {
    defaultFactor: number;

    constructor(
        id: string,
        optionsOrDefaultFactor: MixNodeOptions | number = 0.5
    ) {
        const factor =
            typeof optionsOrDefaultFactor === "number"
                ? optionsOrDefaultFactor
                : (optionsOrDefaultFactor?.defaultFactor ?? 0.5);

        super(id, "Mix", {
            category: "math",
            displayName: "Mix / Lerp",
        });

        this.defaultFactor = factor;

        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addInput({ name: "factor", type: "float" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

export interface BasicShadingOptions {
    ambient?: number;
    diffuse?: number;
    lightDir?: [number, number, number];
}

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

        this.addInput({ name: "color", type: "vec4" });
        this.addInput({ name: "ambient", type: "float" });
        this.addInput({ name: "diffuse", type: "float" });
        this.addInput({ name: "lightDir", type: "vec3" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

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
