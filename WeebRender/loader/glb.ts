import { Mesh, MeshCmp, type Submesh, type VertexAttribute } from "../mesh.js";
import { GMesh } from "../wgpu/wmesh.js";
import { GTexture } from "../wgpu/wtexture.js";
import { Skeleton, type Joint, SkinCmp } from "../skeleton.js";
import { TransformCmp } from "../transform.js";
import { ShaderCmp } from "../shadercmp.js";
import { GShader } from "../wgpu/wshader.js";
import { Texture } from "../texture.js";
import { STANDARD_ATTRIBUTES, SKINNED_ATTRIBUTES } from "../extensions/presets.js";
import { Mat4, Vec3, Quat, type V3, type Q4, type M16 } from "../../Atoolkit/alm/index.js";
import type { Aecs } from "../../Atoolkit/aecs/index.js";
import type { LoadedModel, LoadedMaterial } from "./types.js";

// glTF Component Type constants
const GLTF_BYTE = 5120;
const GLTF_UNSIGNED_BYTE = 5121;
const GLTF_SHORT = 5122;
const GLTF_UNSIGNED_SHORT = 5123;
const GLTF_UNSIGNED_INT = 5125;
const GLTF_FLOAT = 5126;

// Type component counts
const TYPE_NUM_COMPONENTS: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT4: 16,
};

interface GltfAccessor {
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
}

interface GltfBufferView {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
}

interface GltfPrimitive {
    attributes: Record<string, number>;
    indices?: number;
    material?: number;
}

interface GltfMesh {
    name?: string;
    primitives: GltfPrimitive[];
}

interface GltfNode {
    name?: string;
    mesh?: number;
    skin?: number;
    children?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number]; // [x, y, z, w]
    scale?: [number, number, number];
    matrix?: number[];
}

interface GltfSkin {
    name?: string;
    inverseBindMatrices?: number;
    joints: number[];
    skeleton?: number;
}

interface GltfMaterial {
    name?: string;
    pbrMetallicRoughness?: {
        baseColorFactor?: [number, number, number, number];
        baseColorTexture?: { index: number };
        metallicFactor?: number;
        roughnessFactor?: number;
    };
}

interface GltfImage {
    uri?: string;
    bufferView?: number;
    mimeType?: string;
}

interface GltfTexture {
    source?: number;
    sampler?: number;
}

interface GltfRoot {
    asset: { version: string };
    nodes?: GltfNode[];
    meshes?: GltfMesh[];
    skins?: GltfSkin[];
    materials?: GltfMaterial[];
    accessors?: GltfAccessor[];
    bufferViews?: GltfBufferView[];
    images?: GltfImage[];
    textures?: GltfTexture[];
}

/**
 * Reads binary accessor elements into a contiguous typed array or numbers.
 */
function readAccessorElements(
    gltf: GltfRoot,
    bin: Uint8Array,
    accessorIndex: number
): { count: number; numComponents: number; get: (itemIdx: number, compIdx: number) => number } {
    const acc = gltf.accessors?.[accessorIndex];
    if (!acc) {
        return { count: 0, numComponents: 1, get: () => 0 };
    }

    const numComponents = TYPE_NUM_COMPONENTS[acc.type] ?? 1;
    const count = acc.count;

    if (acc.bufferView === undefined) {
        return { count, numComponents, get: () => 0 };
    }

    const bv = gltf.bufferViews?.[acc.bufferView];
    if (!bv) {
        return { count, numComponents, get: () => 0 };
    }

    const viewOffset = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = bv.byteStride ?? 0;
    const compType = acc.componentType;
    const rawBuffer = bin.buffer;
    const baseOffset = bin.byteOffset + viewOffset;

    // Fast path: tightly packed float32
    if (compType === GLTF_FLOAT && stride === 0) {
        const f32 = new Float32Array(rawBuffer, baseOffset, count * numComponents);
        return {
            count,
            numComponents,
            get: (i, c) => f32[i * numComponents + c],
        };
    }

    // Fast path: tightly packed uint16 indices
    if (compType === GLTF_UNSIGNED_SHORT && stride === 0 && !acc.normalized) {
        const u16 = new Uint16Array(rawBuffer, baseOffset, count * numComponents);
        return {
            count,
            numComponents,
            get: (i, c) => u16[i * numComponents + c],
        };
    }

    // Fast path: tightly packed uint32 indices
    if (compType === GLTF_UNSIGNED_INT && stride === 0 && !acc.normalized) {
        const u32 = new Uint32Array(rawBuffer, baseOffset, count * numComponents);
        return {
            count,
            numComponents,
            get: (i, c) => u32[i * numComponents + c],
        };
    }

    // Generic path using DataView for arbitrary component types and strides
    const remainingBytes = Math.min(
        bv.byteLength - (acc.byteOffset ?? 0),
        Math.max(0, rawBuffer.byteLength - baseOffset)
    );
    const view = new DataView(rawBuffer, baseOffset, remainingBytes);
    const compBytes =
        compType === GLTF_FLOAT || compType === GLTF_UNSIGNED_INT ? 4 :
        compType === GLTF_SHORT || compType === GLTF_UNSIGNED_SHORT ? 2 : 1;
    const itemSize = stride > 0 ? stride : numComponents * compBytes;

    return {
        count,
        numComponents,
        get: (i, c) => {
            const bytePos = i * itemSize + c * compBytes;
            switch (compType) {
                case GLTF_FLOAT:
                    return view.getFloat32(bytePos, true);
                case GLTF_UNSIGNED_SHORT:
                    return acc.normalized ? view.getUint16(bytePos, true) / 65535.0 : view.getUint16(bytePos, true);
                case GLTF_SHORT:
                    return acc.normalized ? Math.max(-1.0, view.getInt16(bytePos, true) / 32767.0) : view.getInt16(bytePos, true);
                case GLTF_UNSIGNED_INT:
                    return view.getUint32(bytePos, true);
                case GLTF_UNSIGNED_BYTE:
                    return acc.normalized ? view.getUint8(bytePos) / 255.0 : view.getUint8(bytePos);
                case GLTF_BYTE:
                    return acc.normalized ? Math.max(-1.0, view.getInt8(bytePos) / 127.0) : view.getInt8(bytePos);
                default:
                    return 0;
            }
        },
    };
}

/**
 * Extracts and decodes binary chunks from a GLB file buffer.
 */
export function extractGlbChunks(buffer: ArrayBuffer): { json: GltfRoot; bin: Uint8Array } {
    const view = new DataView(buffer);
    if (view.byteLength < 12) {
        throw new Error("Invalid GLB: File is smaller than 12-byte header");
    }

    // Header validation
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546c67) {
        throw new Error(`Invalid GLB: Expected magic 0x46546c67 ('glTF'), got 0x${magic.toString(16)}`);
    }

    const version = view.getUint32(4, true);
    if (version !== 2) {
        throw new Error(`Unsupported GLB version: ${version}. Only glTF 2.0 is supported.`);
    }

    const totalLength = view.getUint32(8, true);
    if (totalLength > view.byteLength) {
        throw new Error(`Corrupt GLB: Declared length ${totalLength} exceeds buffer ${view.byteLength}`);
    }

    let offset = 12;
    let jsonText = "";
    let binData = new Uint8Array(0);

    // Read chunks sequentially
    while (offset < totalLength) {
        if (offset + 8 > totalLength) break;
        const chunkLength = view.getUint32(offset, true);
        const chunkType = view.getUint32(offset + 4, true);
        offset += 8;

        if (chunkType === 0x4e4f534a) {
            // JSON chunk
            const chunkBytes = new Uint8Array(buffer, offset, chunkLength);
            jsonText = new TextDecoder("utf-8").decode(chunkBytes);
        } else if (chunkType === 0x004e4942) {
            // BIN chunk
            binData = new Uint8Array(buffer, offset, chunkLength);
        }

        offset += chunkLength;
    }

    if (!jsonText) {
        throw new Error("Invalid GLB: Missing JSON chunk");
    }

    const json = JSON.parse(jsonText) as GltfRoot;
    return { json, bin: binData };
}

/**
 * Parses a binary glTF (.glb) buffer into an array of self-contained LoadedModel instances.
 * Smartly bundles primitives sharing a skeleton into a unified Mesh asset adhering to the single-entity contract.
 */
export async function parseGlb(buffer: ArrayBuffer): Promise<LoadedModel[]> {
    const { json: gltf, bin } = extractGlbChunks(buffer);
    const models: LoadedModel[] = [];

    // Decode embedded images
    const textures: (Texture | null)[] = [];
    const gltfImages = gltf.images ?? [];
    const gltfTextures = gltf.textures ?? [];

    const imageCache: (Texture | null)[] = new Array(gltfImages.length).fill(null);
    for (let imgIdx = 0; imgIdx < gltfImages.length; imgIdx++) {
        const img = gltfImages[imgIdx];
        if (img.bufferView !== undefined) {
            const bv = gltf.bufferViews?.[img.bufferView];
            if (bv) {
                const bytes = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0), bv.byteLength);
                const mimeType = img.mimeType ?? 'image/png';
                try {
                    const plainBuf = new Uint8Array(bytes).buffer as ArrayBuffer;
                    const blob = new Blob([plainBuf], { type: mimeType });
                    const bitmap = await createImageBitmap(blob);
                    const w = bitmap.width;
                    const h = bitmap.height;
                    const offscreen = new OffscreenCanvas(w, h);
                    const ctx2d = offscreen.getContext('2d')!;
                    ctx2d.drawImage(bitmap, 0, 0);
                    const imgData = ctx2d.getImageData(0, 0, w, h);
                    const texName = `ModelTex_${imgIdx}`;
                    const tex = new Texture(
                        texName,
                        w, h,
                        new Uint8Array(imgData.data.buffer)
                    );
                    imageCache[imgIdx] = tex;
                    bitmap.close();
                } catch (e) {
                    console.warn(`Failed to decode embedded image ${imgIdx}:`, e);
                }
            }
        }
    }

    // Map glTF texture index -> Texture asset
    for (const gltfTex of gltfTextures) {
        const srcIdx = gltfTex.source ?? -1;
        textures.push(srcIdx >= 0 ? imageCache[srcIdx] : null);
    }

    // Parse Materials
    const materials: LoadedMaterial[] = (gltf.materials ?? []).map((m, idx) => {
        const pbr = m.pbrMetallicRoughness ?? {};
        const texIdx = pbr.baseColorTexture?.index;
        const baseTexture = (texIdx !== undefined && texIdx < textures.length) ? (textures[texIdx] ?? undefined) : undefined;
        return {
            name: m.name ?? `Material_${idx}`,
            baseColorFactor: pbr.baseColorFactor ?? [1, 1, 1, 1],
            baseTexture,
            metallicFactor: pbr.metallicFactor ?? 0,
            roughnessFactor: pbr.roughnessFactor ?? 1,
        };
    });

    // Process nodes with meshes
    const nodes = gltf.nodes ?? [];
    const gltfSkins = gltf.skins ?? [];
    const usedNodeIndices = new Set<number>();

    // 1. Process Skinned Models (group all nodes sharing the same skeleton into ONE LoadedModel)
    for (let skinIdx = 0; skinIdx < gltfSkins.length; skinIdx++) {
        const gltfSkin = gltfSkins[skinIdx];
        const jointNodeIndices = gltfSkin.joints;

        // Find all nodes that reference this skin and have a valid mesh
        const skinnedNodes: { nodeIdx: number; node: GltfNode; mesh: GltfMesh }[] = [];
        for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
            const n = nodes[nIdx];
            if (n.mesh !== undefined && n.skin === skinIdx) {
                const gm = gltf.meshes?.[n.mesh];
                if (gm && gm.primitives.length > 0) {
                    skinnedNodes.push({ nodeIdx: nIdx, node: n, mesh: gm });
                    usedNodeIndices.add(nIdx);
                }
            }
        }

        // Fallback: if no node has node.skin === skinIdx explicitly, find mesh nodes with JOINTS_0
        if (skinnedNodes.length === 0) {
            for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
                const n = nodes[nIdx];
                if (n.mesh !== undefined && !usedNodeIndices.has(nIdx)) {
                    const gm = gltf.meshes?.[n.mesh];
                    if (gm && gm.primitives.some(p => p.attributes.JOINTS_0 !== undefined)) {
                        skinnedNodes.push({ nodeIdx: nIdx, node: n, mesh: gm });
                        usedNodeIndices.add(nIdx);
                    }
                }
            }
        }

        if (skinnedNodes.length === 0) continue;

        // Build Skeleton once for this skin
        const joints: Joint[] = [];
        let invBindGetter: { get: (i: number, c: number) => number } | null = null;
        if (gltfSkin.inverseBindMatrices !== undefined) {
            invBindGetter = readAccessorElements(gltf, bin, gltfSkin.inverseBindMatrices);
        }

        for (let jIdx = 0; jIdx < jointNodeIndices.length; jIdx++) {
            const jNodeIdx = jointNodeIndices[jIdx];
            const jNode = nodes[jNodeIdx];

            // Walk up parent chain in nodes to locate parent joint in jointNodeIndices
            let parentIndex = -1;
            let currNodeIdx = jNodeIdx;
            while (currNodeIdx >= 0 && parentIndex === -1) {
                let foundParent = -1;
                for (let pCandidate = 0; pCandidate < nodes.length; pCandidate++) {
                    if (nodes[pCandidate]?.children?.includes(currNodeIdx)) {
                        foundParent = pCandidate;
                        break;
                    }
                }
                if (foundParent === -1) break;
                const pInJoints = jointNodeIndices.indexOf(foundParent);
                if (pInJoints >= 0) {
                    parentIndex = pInJoints;
                    break;
                }
                currNodeIdx = foundParent;
            }

            // Extract position, rotation, and scale from TRS or node matrix
            let pos = Vec3(0, 0, 0);
            let rot = Quat.makeIdentity();
            let scale = Vec3(1, 1, 1);

            if (jNode?.translation) {
                pos = Vec3(jNode.translation[0], jNode.translation[1], jNode.translation[2]);
            }
            if (jNode?.rotation) {
                rot = Quat(jNode.rotation[0], jNode.rotation[1], jNode.rotation[2], jNode.rotation[3]);
            }
            if (jNode?.scale) {
                scale = Vec3(jNode.scale[0], jNode.scale[1], jNode.scale[2]);
            }
            if (jNode?.matrix && !jNode.translation && !jNode.rotation && !jNode.scale) {
                const m = jNode.matrix;
                pos = Vec3(m[12], m[13], m[14]);
                const sx = Math.hypot(m[0], m[1], m[2]);
                const sy = Math.hypot(m[4], m[5], m[6]);
                const sz = Math.hypot(m[8], m[9], m[10]);
                scale = Vec3(sx, sy, sz);
                if (sx > 1e-6 && sy > 1e-6 && sz > 1e-6) {
                    const rotM = Mat4();
                    rotM[0] = m[0]/sx; rotM[1] = m[1]/sx; rotM[2] = m[2]/sx;
                    rotM[4] = m[4]/sy; rotM[5] = m[5]/sy; rotM[6] = m[6]/sy;
                    rotM[8] = m[8]/sz; rotM[9] = m[9]/sz; rotM[10] = m[10]/sz;
                    rotM[15] = 1;
                    Quat.fromM4(rotM, rot);
                }
            }

            // Inverse bind matrix
            const invBind = Mat4.makeIdentity();
            if (invBindGetter) {
                for (let c = 0; c < 16; c++) {
                    invBind[c] = invBindGetter.get(jIdx, c);
                }
            }

            joints.push({
                name: jNode?.name ?? `Joint_${jIdx}`,
                parentIndex,
                invBindMatrix: invBind,
                localTransform: {
                    position: pos,
                    rotation: rot,
                    scale,
                },
            });
        }

        const skeleton = new Skeleton(gltfSkin.name ?? `Skeleton_${skinIdx}`, joints);

        // Aggregate ALL primitives across all skinned nodes into a single Mesh
        const stride = 64;
        const attributes: VertexAttribute[] = SKINNED_ATTRIBUTES;
        const submeshes: Submesh[] = [];
        const submeshMatSlots: number[] = [];
        const allIndices: number[] = [];
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const jointsArr: number[] = [];
        const weightsArr: number[] = [];

        for (const sNode of skinnedNodes) {
            for (const prim of sNode.mesh.primitives) {
                const primIndexStart = allIndices.length;
                const vertexBase = positions.length / 3;

                // POSITION
                const posAcc = readAccessorElements(gltf, bin, prim.attributes.POSITION);
                const vertCount = posAcc.count;
                if (vertCount === 0) continue;

                for (let v = 0; v < vertCount; v++) {
                    positions.push(posAcc.get(v, 0), posAcc.get(v, 1), posAcc.get(v, 2));
                }

                // NORMAL
                if (prim.attributes.NORMAL !== undefined) {
                    const normAcc = readAccessorElements(gltf, bin, prim.attributes.NORMAL);
                    for (let v = 0; v < vertCount; v++) {
                        normals.push(normAcc.get(v, 0), normAcc.get(v, 1), normAcc.get(v, 2));
                    }
                } else {
                    for (let v = 0; v < vertCount; v++) normals.push(0, 1, 0);
                }

                // TEXCOORD_0
                if (prim.attributes.TEXCOORD_0 !== undefined) {
                    const uvAcc = readAccessorElements(gltf, bin, prim.attributes.TEXCOORD_0);
                    for (let v = 0; v < vertCount; v++) {
                        uvs.push(uvAcc.get(v, 0), uvAcc.get(v, 1));
                    }
                } else {
                    for (let v = 0; v < vertCount; v++) uvs.push(0, 0);
                }

                // JOINTS_0 & WEIGHTS_0
                if (prim.attributes.JOINTS_0 !== undefined && prim.attributes.WEIGHTS_0 !== undefined) {
                    const jAcc = readAccessorElements(gltf, bin, prim.attributes.JOINTS_0);
                    const wAcc = readAccessorElements(gltf, bin, prim.attributes.WEIGHTS_0);
                    for (let v = 0; v < vertCount; v++) {
                        jointsArr.push(jAcc.get(v, 0), jAcc.get(v, 1), jAcc.get(v, 2), jAcc.get(v, 3));
                        weightsArr.push(wAcc.get(v, 0), wAcc.get(v, 1), wAcc.get(v, 2), wAcc.get(v, 3));
                    }
                } else {
                    for (let v = 0; v < vertCount; v++) {
                        jointsArr.push(0, 0, 0, 0);
                        weightsArr.push(1, 0, 0, 0);
                    }
                }

                // INDICES
                if (prim.indices !== undefined) {
                    const idxAcc = readAccessorElements(gltf, bin, prim.indices);
                    for (let i = 0; i < idxAcc.count; i++) {
                        allIndices.push(vertexBase + idxAcc.get(i, 0));
                    }
                } else {
                    for (let v = 0; v < vertCount; v++) {
                        allIndices.push(vertexBase + v);
                    }
                }

                submeshes.push({
                    name: `${sNode.mesh.name ?? "Mesh"}_Submesh_${submeshes.length}`,
                    indexStart: primIndexStart,
                    indexCount: allIndices.length - primIndexStart,
                });
                submeshMatSlots.push(prim.material ?? 0);
            }
        }

        const totalVertices = positions.length / 3;
        if (totalVertices > 0) {
            const vertexBuffer = new ArrayBuffer(totalVertices * stride);
            const f32 = new Float32Array(vertexBuffer);
            const u32 = new Uint32Array(vertexBuffer);

            for (let i = 0; i < totalVertices; i++) {
                const base = i * 16;
                f32[base + 0] = positions[i * 3 + 0];
                f32[base + 1] = positions[i * 3 + 1];
                f32[base + 2] = positions[i * 3 + 2];
                f32[base + 3] = normals[i * 3 + 0];
                f32[base + 4] = normals[i * 3 + 1];
                f32[base + 5] = normals[i * 3 + 2];
                f32[base + 6] = uvs[i * 2 + 0];
                f32[base + 7] = uvs[i * 2 + 1];
                u32[base + 8] = jointsArr[i * 4 + 0];
                u32[base + 9] = jointsArr[i * 4 + 1];
                u32[base + 10] = jointsArr[i * 4 + 2];
                u32[base + 11] = jointsArr[i * 4 + 3];
                f32[base + 12] = weightsArr[i * 4 + 0];
                f32[base + 13] = weightsArr[i * 4 + 1];
                f32[base + 14] = weightsArr[i * 4 + 2];
                f32[base + 15] = weightsArr[i * 4 + 3];
            }

            const is32Bit = totalVertices > 65535;
            const indicesTyped = is32Bit ? new Uint32Array(allIndices) : new Uint16Array(allIndices);

            const modelName = gltfSkin.name ?? skinnedNodes[0]?.node.name ?? `SkinnedModel_${skinIdx}`;
            const mesh = new Mesh(modelName, f32, indicesTyped, submeshes, stride, attributes);

            // Build material component
            const submeshShaders: (GShader | null)[] = [];
            const submeshParams: (Record<string, any> | null)[] = [];

            for (let i = 0; i < submeshes.length; i++) {
                const matIdx = submeshMatSlots[i];
                const mat = materials[matIdx];
                if (mat?.baseTexture) {
                    submeshShaders.push(null);
                    submeshParams.push({
                        mainTexture: null,
                        tintColor: mat.baseColorFactor,
                    });
                } else {
                    const color = mat?.baseColorFactor ?? [0.9, 0.9, 0.95, 1.0];
                    submeshShaders.push(null);
                    submeshParams.push({
                        baseColor: color,
                    });
                }
            }

            const shaderCmp = new ShaderCmp(submeshShaders, submeshParams);

            models.push({
                name: modelName,
                mesh,
                skeleton,
                materials,
                shaderCmp,
            });
        }
    }

    // 2. Process any remaining unskinned mesh nodes
    for (let nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
        if (usedNodeIndices.has(nodeIdx)) continue;
        const node = nodes[nodeIdx];
        if (node.mesh === undefined) continue;

        const gltfMesh = gltf.meshes?.[node.mesh];
        if (!gltfMesh || gltfMesh.primitives.length === 0) continue;

        const modelName = node.name ?? gltfMesh.name ?? `StaticModel_${nodeIdx}`;
        const stride = 32;
        const attributes: VertexAttribute[] = STANDARD_ATTRIBUTES;

        const submeshes: Submesh[] = [];
        const submeshMatSlots: number[] = [];
        const allIndices: number[] = [];
        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        for (const prim of gltfMesh.primitives) {
            const primIndexStart = allIndices.length;
            const vertexBase = positions.length / 3;

            const posAcc = readAccessorElements(gltf, bin, prim.attributes.POSITION);
            const vertCount = posAcc.count;
            if (vertCount === 0) continue;

            for (let v = 0; v < vertCount; v++) {
                positions.push(posAcc.get(v, 0), posAcc.get(v, 1), posAcc.get(v, 2));
            }

            if (prim.attributes.NORMAL !== undefined) {
                const normAcc = readAccessorElements(gltf, bin, prim.attributes.NORMAL);
                for (let v = 0; v < vertCount; v++) {
                    normals.push(normAcc.get(v, 0), normAcc.get(v, 1), normAcc.get(v, 2));
                }
            } else {
                for (let v = 0; v < vertCount; v++) normals.push(0, 1, 0);
            }

            if (prim.attributes.TEXCOORD_0 !== undefined) {
                const uvAcc = readAccessorElements(gltf, bin, prim.attributes.TEXCOORD_0);
                for (let v = 0; v < vertCount; v++) {
                    uvs.push(uvAcc.get(v, 0), uvAcc.get(v, 1));
                }
            } else {
                for (let v = 0; v < vertCount; v++) uvs.push(0, 0);
            }

            if (prim.indices !== undefined) {
                const idxAcc = readAccessorElements(gltf, bin, prim.indices);
                for (let i = 0; i < idxAcc.count; i++) {
                    allIndices.push(vertexBase + idxAcc.get(i, 0));
                }
            } else {
                for (let v = 0; v < vertCount; v++) allIndices.push(vertexBase + v);
            }

            submeshes.push({
                name: `Submesh_${submeshes.length}`,
                indexStart: primIndexStart,
                indexCount: allIndices.length - primIndexStart,
            });
            submeshMatSlots.push(prim.material ?? 0);
        }

        const totalVertices = positions.length / 3;
        if (totalVertices === 0) continue;

        const vertexBuffer = new ArrayBuffer(totalVertices * stride);
        const f32 = new Float32Array(vertexBuffer);
        for (let i = 0; i < totalVertices; i++) {
            const base = i * 8;
            f32[base + 0] = positions[i * 3 + 0];
            f32[base + 1] = positions[i * 3 + 1];
            f32[base + 2] = positions[i * 3 + 2];
            f32[base + 3] = normals[i * 3 + 0];
            f32[base + 4] = normals[i * 3 + 1];
            f32[base + 5] = normals[i * 3 + 2];
            f32[base + 6] = uvs[i * 2 + 0];
            f32[base + 7] = uvs[i * 2 + 1];
        }

        const is32Bit = totalVertices > 65535;
        const indicesTyped = is32Bit ? new Uint32Array(allIndices) : new Uint16Array(allIndices);
        const mesh = new Mesh(modelName, f32, indicesTyped, submeshes, stride, attributes);

        // Build material component
        const submeshShaders: (GShader | null)[] = [];
        const submeshParams: (Record<string, any> | null)[] = [];

        for (let i = 0; i < submeshes.length; i++) {
            const matIdx = submeshMatSlots[i];
            const mat = materials[matIdx];
            if (mat?.baseTexture) {
                submeshShaders.push(null);
                submeshParams.push({
                    mainTexture: null,
                    tintColor: mat.baseColorFactor,
                });
            } else {
                const color = mat?.baseColorFactor ?? [0.9, 0.9, 0.95, 1.0];
                submeshShaders.push(null);
                submeshParams.push({
                    baseColor: color,
                });
            }
        }

        const shaderCmp = new ShaderCmp(submeshShaders, submeshParams);

        models.push({
            name: modelName,
            mesh,
            materials,
            shaderCmp,
        });
    }

    return models;
}

/**
 * Loads and parses a GLB file from a remote or local URL.
 */
export async function loadGlbFromUrl(url: string): Promise<LoadedModel[]> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load GLB from ${url}: HTTP ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    return parseGlb(buffer);
}

/**
 * Parses a GLB File object from an input element or drag-and-drop event.
 */
export async function loadGlbFromFile(file: File): Promise<LoadedModel[]> {
    const buffer = await file.arrayBuffer();
    return parseGlb(buffer);
}

/**
 * Spawns a loaded model into an Aecs scene adhering to the single-entity contract.
 * Co-locates TransformCmp, MeshCmp, and SkinCmp directly on the spawned entity.
 */
export function spawnLoadedModel(
    ecs: Aecs,
    model: LoadedModel,
    transformOrPos?: TransformCmp | ArrayLike<number>,
    device?: GPUDevice
): number {
    let transform: TransformCmp;
    if (transformOrPos instanceof TransformCmp) {
        transform = transformOrPos;
    } else if (transformOrPos) {
        transform = new TransformCmp(transformOrPos);
    } else {
        transform = new TransformCmp();
    }

    if (device) {
        if (!model.gMesh) {
            model.gMesh = GMesh.fromMesh(device, model.mesh);
        }
        for (let mIdx = 0; mIdx < model.materials.length; mIdx++) {
            const mat = model.materials[mIdx];
            if (mat.baseTexture && !mat.gTexture) {
                mat.gTexture = GTexture.fromTexture(device, mat.baseTexture);
            }
        }
        if (model.shaderCmp) {
            for (let sIdx = 0; sIdx < model.shaderCmp.params.length; sIdx++) {
                const params = model.shaderCmp.params[sIdx];
                const mat = model.materials[sIdx] ?? model.materials[0];
                if (params && mat?.gTexture) {
                    params.mainTexture = mat.gTexture;
                }
            }
        }
    }

    if (!model.gMesh) {
        throw new Error(`[spawnLoadedModel] Model "${model.name}" has not been uploaded to GPU. Pass device to spawnLoadedModel or assign model.gMesh.`);
    }

    const meshCmp = new MeshCmp(model.gMesh);
    const shaderCmp = model.shaderCmp ?? new ShaderCmp();

    if (model.skeleton) {
        const skinCmp = new SkinCmp(model.skeleton);
        return ecs.spawn(transform, meshCmp, skinCmp, shaderCmp);
    }

    return ecs.spawn(transform, meshCmp, shaderCmp);
}
