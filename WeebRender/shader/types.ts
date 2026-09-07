import { Asocket, type Awire } from "../../Atoolkit/adataflow/index.js";
import type { GpuTexture } from "../gpu.js";

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
    defaultTexture: GpuTexture | null;
}

/**
 * Immutable snapshot of a TextureSampleNode captured at compile time.
 * Contains no reference to the live ShaderGraph or its nodes.
 */
export interface CompiledTextureNode {
    /** Node id from the source graph, used as a stable key. */
    readonly nodeId: string;
    /** Texture binding index within the shader (0-based). */
    readonly textureIndex: number;
    /** Whether this texture was exposed as a material parameter. */
    readonly isParam: boolean;
    /** Param name under which the texture is exposed (only meaningful when isParam=true). */
    readonly paramName: string | undefined;
    /** Default texture captured at compile time. Never a live node reference. */
    readonly defaultTexture: import("../gpu.js").GpuTexture | null;
}

export interface ShaderParamLayout {
    uniforms: Map<string, UniformParamDef>;
    textures: Map<string, TextureParamDef>;
    totalUniformBytes: number;
    defaultUniformData: Float32Array;
}
