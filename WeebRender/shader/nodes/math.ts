import { ShaderNode, type NodeCompileContext } from "./base.js";
import { type ShaderParamProvider } from "./params.js";

export interface FloatNodeOptions {
    value?: number;
    isParam?: boolean;
    paramName?: string;
}

/**
 * Float Node: Emits a float scalar constant or parameter uniform.
 * Output: "value" (float).
 */
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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        if (this.isParam && this.paramName) {
            return `
    let ${p}_value: f32 = ${ctx.uniformVarName}.${this.paramName};`;
        }

        return `
    let ${p}_value: f32 = ${this.defaultValue.toFixed(4)};`;
    }
}

/**
 * Dedicated Constant Float Node:
 * Emits an inline compile-time f32 literal with zero uniform buffer overhead.
 */
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

/**
 * Math Node: Performs arithmetic operations between two vec4 inputs.
 * Pure computation unit with zero uniform parameter overhead.
 * Inputs: "a" (vec4), "b" (vec4).
 * Output: "out" (vec4).
 */
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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        const inA = ctx.inputs["a"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const inB = ctx.inputs["b"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";

        let op = "*";
        if (this.operation === "add") op = "+";
        else if (this.operation === "subtract") op = "-";
        else if (this.operation === "divide") op = "/";

        return `let ${p}_out = ${inA} ${op} ${inB};`;
    }
}

export interface MixNodeOptions {
    defaultFactor?: number;
}

/**
 * Mix Node: Linearly interpolates between two vec4 inputs based on a factor float.
 * Pure computation unit with zero uniform parameter overhead.
 * Inputs: "a" (vec4), "b" (vec4), "factor" (float [0..1]).
 * Output: "out" (vec4).
 */
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

    generateWGSL(ctx: NodeCompileContext): string {
        const p = ctx.varPrefix;
        const inA = ctx.inputs["a"] ?? "vec4<f32>(0.0, 0.0, 0.0, 1.0)";
        const inB = ctx.inputs["b"] ?? "vec4<f32>(1.0, 1.0, 1.0, 1.0)";
        const inFactor = ctx.inputs["factor"] ?? `${this.defaultFactor.toFixed(4)}`;

        return `
    let ${p}_out = mix(${inA}, ${inB}, ${inFactor});`;
    }
}
