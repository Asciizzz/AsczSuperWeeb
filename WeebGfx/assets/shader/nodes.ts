import { Acnode, Asocket } from "../../../Atoolkit/acircuit/index.js";
import { ShaderSocket, type SocketType } from "./types.js";
import type { GpuTexture } from "../../gpu/gtexture.js";

export abstract class ShaderNode extends Acnode {
    readonly nodeType: string;

    constructor(id: string, name: string, nodeType: string) {
        super(id, name);
        this.nodeType = nodeType;
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

    override process(): Record<string, any> {
        return {};
    }
}

export interface IShaderParam {
    readonly isParam: boolean;
    readonly paramName?: string;
}

export function isShaderParam(node: unknown): node is IShaderParam {
    return typeof node === "object" && node !== null && "isParam" in node && (node as any).isParam === true;
}

export class OutputNode extends ShaderNode {
    constructor(id = "output") {
        super(id, "Output", "output");
        this.addInput({ name: "baseColor", type: "vec4" });
        this.addInput({ name: "emissive", type: "vec3" });
        this.addInput({ name: "alpha", type: "float" });
        this.addInput({ name: "vertexOffset", type: "vec3" });
    }
}

export class ColorNode extends ShaderNode implements IShaderParam {
    readonly defaultColor: [number, number, number, number];
    readonly isParam: boolean;
    readonly paramName?: string;

    constructor(
        id: string,
        color: [number, number, number, number] = [1, 1, 1, 1],
        isParam = false,
        paramName?: string
    ) {
        super(id, paramName ? `Color: ${paramName}` : "Color", "color");
        this.defaultColor = color;
        this.isParam = isParam;
        this.paramName = isParam ? (paramName ?? id) : undefined;

        this.addOutput({ name: "color", type: "vec4" });
        this.addOutput({ name: "rgb", type: "vec3" });
        this.addOutput({ name: "alpha", type: "float" });
    }
}

export class FloatNode extends ShaderNode implements IShaderParam {
    readonly defaultValue: number;
    readonly isParam: boolean;
    readonly paramName?: string;

    constructor(id: string, value = 0.0, isParam = false, paramName?: string) {
        super(id, paramName ? `Float: ${paramName}` : "Float", "float");
        this.defaultValue = value;
        this.isParam = isParam;
        this.paramName = isParam ? (paramName ?? id) : undefined;

        this.addOutput({ name: "value", type: "float" });
    }
}

export class TextureSampleNode extends ShaderNode implements IShaderParam {
    readonly isParam: boolean;
    readonly paramName?: string;
    readonly defaultTexture: GpuTexture | null;
    textureIndex = 0;

    constructor(id: string, isParam = true, paramName?: string, defaultTexture?: GpuTexture | null) {
        super(id, paramName ? `Texture: ${paramName}` : "TextureSample", "textureSample");
        this.isParam = isParam;
        this.paramName = isParam ? (paramName ?? id) : undefined;
        this.defaultTexture = defaultTexture ?? null;

        this.addInput({ name: "uv", type: "vec2" });
        this.addOutput({ name: "color", type: "vec4" });
        this.addOutput({ name: "rgb", type: "vec3" });
        this.addOutput({ name: "alpha", type: "float" });
    }
}

export class TimeNode extends ShaderNode {
    constructor(id = "time") {
        super(id, "Time & Beat", "time");
        this.addOutput({ name: "time", type: "float" });
        this.addOutput({ name: "sinTime", type: "float" });
        this.addOutput({ name: "beatPulse", type: "float" });
    }
}

export class MathNode extends ShaderNode {
    readonly operation: "add" | "subtract" | "multiply" | "divide";

    constructor(id: string, operation: "add" | "subtract" | "multiply" | "divide" = "multiply") {
        super(id, `Math: ${operation}`, "math");
        this.operation = operation;
        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

export class MixNode extends ShaderNode {
    readonly defaultFactor: number;

    constructor(id: string, defaultFactor = 0.5) {
        super(id, "Mix", "mix");
        this.defaultFactor = defaultFactor;
        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addInput({ name: "factor", type: "float" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

export class SmoothStepNode extends ShaderNode {
    readonly edge0: number;
    readonly edge1: number;

    constructor(id: string, edge0 = 0.0, edge1 = 1.0) {
        super(id, "SmoothStep", "smoothstep");
        this.edge0 = edge0;
        this.edge1 = edge1;
        this.addInput({ name: "x", type: "float" });
        this.addInput({ name: "edge0", type: "float" });
        this.addInput({ name: "edge1", type: "float" });
        this.addOutput({ name: "out", type: "float" });
    }
}

export class SDFShapeNode extends ShaderNode {
    readonly shape: "circle" | "rect" | "ring" | "diamond";

    constructor(id: string, shape: "circle" | "rect" | "ring" | "diamond" = "circle") {
        super(id, `SDF: ${shape}`, "sdfShape");
        this.shape = shape;
        this.addInput({ name: "uv", type: "vec2" });
        this.addInput({ name: "radius", type: "float" });
        this.addOutput({ name: "dist", type: "float" });
        this.addOutput({ name: "mask", type: "float" });
    }
}

export class BlendNode extends ShaderNode {
    readonly defaultMode: number;
    readonly defaultFactor: number;

    constructor(id: string, defaultMode = 0, defaultFactor = 1.0) {
        super(id, "Blend", "blend");
        this.defaultMode = defaultMode;
        this.defaultFactor = defaultFactor;
        this.addInput({ name: "a", type: "vec4" });
        this.addInput({ name: "b", type: "vec4" });
        this.addInput({ name: "mode", type: "float" });
        this.addInput({ name: "factor", type: "float" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}

export class BasicShadingNode extends ShaderNode {
    readonly defaultAmbient: number;
    readonly defaultDiffuse: number;

    constructor(id: string, defaultAmbient = 0.25, defaultDiffuse = 0.8) {
        super(id, "BasicShading", "basicShading");
        this.defaultAmbient = defaultAmbient;
        this.defaultDiffuse = defaultDiffuse;
        this.addInput({ name: "color", type: "vec4" });
        this.addInput({ name: "lightDir", type: "vec3" });
        this.addInput({ name: "ambient", type: "float" });
        this.addInput({ name: "diffuse", type: "float" });
        this.addOutput({ name: "out", type: "vec4" });
    }
}
