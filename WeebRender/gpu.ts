import type { Submesh, VertexAttribute, Mesh } from "./mesh.js";
import type { Texture } from "./texture.js";
import type { ShaderCircuit } from "./shader/circuit.js";
import type { TextureSampleNode } from "./shader/nodes.js";
import type { ShaderParamLayout } from "./shader/types.js";
import type { MaterialParamRecord } from "./material.js";
import { ShaderParamsCmp } from "./shader/params.js";

let nextGpuTextureId = 0;
let nextGpuMeshId = 0;
let nextGpuShaderId = 0;

/**
 * Universal GPU Texture handle.
 * Holds dimensions and common metadata.
 * Hardware-specific data (WebGPU textures/views or WebGL2 textures) is held in `backend`.
 */
export class GpuTexture<TBackend = unknown> {
    readonly id: number;
    name: string;
    width: number;
    height: number;
    backend: TBackend;
    gpuOwned: boolean;
    cpuTexture?: Texture;

    constructor(name = "GpuTexture", width = 1, height = 1, backend: TBackend = undefined as any, gpuOwned = true) {
        this.id = ++nextGpuTextureId;
        this.name = name;
        this.width = width;
        this.height = height;
        this.backend = backend;
        this.gpuOwned = gpuOwned;
    }
}

/**
 * Universal GPU Mesh handle.
 * Holds vertex counts, index counts, layout, and submeshes.
 * Hardware-specific buffers (WebGPU GPUBuffers or WebGL2 VAO/VBO/IBO) are held in `backend`.
 */
export class GpuMesh<TBackend = unknown> {
    readonly id: number;
    name: string;
    vertexCount: number;
    indexCount: number;
    stride: number;
    attributes: VertexAttribute[];
    submeshes: Submesh[];
    backend: TBackend;
    gpuOwned: boolean;
    cpuMesh?: Mesh;

    constructor(
        name = "GpuMesh",
        vertexCount = 0,
        indexCount = 0,
        stride = 32,
        attributes: VertexAttribute[] = [],
        submeshes: Submesh[] = [],
        backend: TBackend = undefined as any,
        gpuOwned = true
    ) {
        this.id = ++nextGpuMeshId;
        this.name = name;
        this.vertexCount = vertexCount;
        this.indexCount = indexCount;
        this.stride = stride;
        this.attributes = attributes;
        this.submeshes = submeshes;
        this.backend = backend;
        this.gpuOwned = gpuOwned;
    }
}

/**
 * Universal GPU Shader handle.
 * Holds reference to the authoring ShaderCircuit and precomputed parameter layout.
 * Hardware-specific pipeline state (WebGPU GPURenderPipeline or WebGL2 program) is held in `backend`.
 */
export class GpuShader<TBackend = unknown> {
    readonly id: number;
    name: string;
    circuit: ShaderCircuit;
    paramLayout: ShaderParamLayout;
    textureNodes: TextureSampleNode[];
    backend: TBackend;
    gpuOwned: boolean;

    constructor(
        name = "GpuShader",
        circuit: ShaderCircuit,
        paramLayout: ShaderParamLayout,
        textureNodes: TextureSampleNode[] = [],
        backend: TBackend = undefined as any,
        gpuOwned = true
    ) {
        this.id = ++nextGpuShaderId;
        this.name = name;
        this.circuit = circuit;
        this.paramLayout = paramLayout;
        this.textureNodes = textureNodes;
        this.backend = backend;
        this.gpuOwned = gpuOwned;
    }

    /**
     * Builds a default parameter values record based on the shader's paramLayout.
     */
    createDefaultParams(): MaterialParamRecord {
        const rec: MaterialParamRecord = {};
        if (this.paramLayout) {
            for (const [name, u] of this.paramLayout.uniforms) {
                rec[name] = Array.isArray(u.defaultValue) ? [...u.defaultValue] : u.defaultValue;
            }
            for (const [name, t] of this.paramLayout.textures) {
                rec[name] = t.defaultTexture;
            }
        }
        return rec;
    }

    /**
     * Gets all uniform and texture parameter names declared by this shader.
     */
    getParamNames(): string[] {
        if (!this.paramLayout) return [];
        return [
            ...Array.from(this.paramLayout.uniforms.keys()),
            ...Array.from(this.paramLayout.textures.keys()),
        ];
    }

    /**
     * Checks if this shader declares a uniform or texture parameter by name.
     */
    hasParam(name: string): boolean {
        if (!this.paramLayout) return false;
        return this.paramLayout.uniforms.has(name) || this.paramLayout.textures.has(name);
    }

    /**
     * Gets the default value for a declared parameter (cloned array for vec4, number for float, GpuTexture for texture).
     */
    getDefaultParam(name: string): unknown {
        if (!this.paramLayout) return undefined;
        const u = this.paramLayout.uniforms.get(name);
        if (u) {
            return Array.isArray(u.defaultValue) ? [...u.defaultValue] : u.defaultValue;
        }
        const t = this.paramLayout.textures.get(name);
        if (t) {
            return t.defaultTexture;
        }
        return undefined;
    }

    /**
     * Creates a ShaderParamsCmp pre-populated with this shader's default parameters and optional overrides.
     */
    createParamsCmp(overrides?: MaterialParamRecord): ShaderParamsCmp {
        const values = {
            ...this.createDefaultParams(),
            ...(overrides ?? {}),
        };
        return new ShaderParamsCmp(values, this as any);
    }
}

export function isGpuTexture(val: unknown): val is GpuTexture {
    return val instanceof GpuTexture;
}

export function isGpuMesh(val: unknown): val is GpuMesh {
    return val instanceof GpuMesh;
}

export function isGpuShader(val: unknown): val is GpuShader {
    return val instanceof GpuShader;
}

// Ergonomic aliases
export { GpuTexture as GTexture, GpuMesh as GMesh, GpuShader as GShader, GpuShader as Shader };
export { isGpuTexture as isGTexture, isGpuMesh as isGMesh, isGpuShader as isGShader };
