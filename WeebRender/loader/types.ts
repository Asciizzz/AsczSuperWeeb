import type { Mesh } from "../mesh.js";
import type { Skeleton } from "../skeleton.js";
import type { Texture } from "../texture.js";
import type { MaterialCmp } from "../material.js";
import type { GMesh } from "../wgpu/gmesh.js";

export interface LoadedMaterial {
    name: string;
    baseColorFactor: [number, number, number, number];
    baseTexture?: Texture;
    metallicFactor: number;
    roughnessFactor: number;
}

export interface LoadedModel {
    name: string;
    mesh: Mesh;
    gMesh?: GMesh;
    skeleton?: Skeleton;
    materials: LoadedMaterial[];
    materialCmp?: MaterialCmp;
}

export interface GlbHeader {
    magic: number;
    version: number;
    length: number;
}

export interface GlbChunk {
    type: string;
    data: Uint8Array;
}
