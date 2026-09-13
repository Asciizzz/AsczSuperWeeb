import { Asocket, type Awire, type SocketDirection } from "../../../Atoolkit/acircuit/index.js";
import type { GpuTexture } from "../../gpu/gtexture.js";

export type SocketType = "float" | "vec2" | "vec3" | "vec4" | "texture2d";

export class ShaderSocket extends Asocket {
    type: SocketType;
    constructor(name: string, type: SocketType, direction: SocketDirection = "input") {
        super(name, direction);
        this.type = type;
    }
}

export type { Awire };

export type UniformParamType = "float" | "vec2" | "vec3" | "vec4";

export interface UniformParamDef {
    name: string;
    type: UniformParamType;
    byteOffset: number;
    sizeBytes: number;
    defaultValue: number | number[];
}

export interface TextureParamDef {
    name: string;
    textureIndex: number;
    bindingIndex?: number;
    defaultTexture: GpuTexture | null;
}

export interface ShaderParamLayout {
    uniforms: Map<string, UniformParamDef>;
    textures: Map<string, TextureParamDef>;
    totalUniformBytes: number;
    defaultUniformData: Float32Array;
}

export type ShaderBlendMode = "opaque" | "alpha-blend" | "additive" | "multiply";
export type ShaderCullMode = "none" | "back" | "front";
export type ShaderDepthMode = "read-write" | "read-only" | "disabled";

export interface PipelineRenderState {
    blendMode?: ShaderBlendMode;
    cullMode?: ShaderCullMode;
    depthMode?: ShaderDepthMode;
}
