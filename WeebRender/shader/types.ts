import { Asocket, type Awire } from "../../Atoolkit/adataflow/index.js";
import type { Texture } from "../texture.js";

export type SocketType = "float" | "vec2" | "vec3" | "vec4" | "texture2d";

export class ShaderSocket extends Asocket {
    type: SocketType;
    constructor(name: string, type: SocketType) {
        super(name);
        this.type = type;
    }
}

export type InputSocket = ShaderSocket;
export type OutputSocket = ShaderSocket;

export interface SocketLink {
    srcSocket: string; // Output socket on source node
    dstSocket: string; // Input socket on destination node
}

export type { Awire };

export type ShaderParamType = "float" | "vec2" | "vec3" | "vec4" | "texture2d";

export interface UniformParamDef {
    name: string;
    type: "float" | "vec2" | "vec3" | "vec4";
    byteOffset: number;
    sizeBytes: number;
    defaultValue: number | number[];
}

export interface TextureParamDef {
    name: string;
    bindingIndex: number;
    defaultTexture: Texture | null;
}

export interface ShaderParamLayout {
    uniforms: Map<string, UniformParamDef>;
    textures: Map<string, TextureParamDef>;
    totalUniformBytes: number;
    defaultUniformData: Float32Array;
}
