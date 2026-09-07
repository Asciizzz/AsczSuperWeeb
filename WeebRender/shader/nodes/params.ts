import { ShaderNode, type NodeCompileContext } from "./base.js";

/**
 * Interface implemented by nodes that declare GPU uniform parameters or texture bindings.
 * Isolates GPU uniform memory management from purely mathematical/color computation nodes.
 */
export interface ShaderParamProvider {
    readonly isParam: boolean;
    readonly paramName?: string;
}

/**
 * Type guard checking if a node acts as a GPU shader parameter source.
 */
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

/**
 * Dedicated Vec4 Uniform Parameter Node:
 * Explicitly binds a vec4 uniform in @group(2) @binding(0).
 * Outputs: "color" (vec4), "rgb" (vec3), "alpha" (float).
 */
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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        return `
    let ${p}_color: vec4<f32> = ${ctx.uniformVarName}.${this.paramName};
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }
}

export interface ParamFloatOptions {
    defaultValue?: number;
    displayName?: string;
}

/**
 * Dedicated Float Uniform Parameter Node:
 * Explicitly binds an f32 uniform in @group(2) @binding(0).
 * Output: "value" (float).
 */
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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        return `let ${p}_value: f32 = ${ctx.uniformVarName}.${this.paramName};`;
    }
}
