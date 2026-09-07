import { Mat4, Vec3, Quat } from "../../Atoolkit/alm/index.js";

/**
 * Procedurally synthesizes a valid binary glTF 2.0 (.glb) buffer in memory.
 * Features a 3-joint rigged robotic arm with 3 bone segments, skinning weights,
 * and valid inverse bind matrices according to the glTF 2.0 specification.
 */
export function createSampleRiggedGlb(): ArrayBuffer {
    const segments = 12;
    const height = 3.0;
    const radius = 0.35;
    const ringVertCount = 6;
    const totalRings = segments + 1;
    const totalVerts = totalRings * ringVertCount + 2; // rings + top/bottom poles

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const joints: number[] = [];
    const weights: number[] = [];

    // Joint 0: y in [0.0 .. 1.0]
    // Joint 1: y in [1.0 .. 2.0]
    // Joint 2: y in [2.0 .. 3.0]
    for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const y = t * height;

        // Weights distribution across 3 joints
        let w0 = 0;
        let w1 = 0;
        let w2 = 0;

        if (y <= 1.5) {
            const factor = y / 1.5;
            w0 = 1.0 - factor;
            w1 = factor;
        } else {
            const factor = (y - 1.5) / 1.5;
            w1 = 1.0 - factor;
            w2 = factor;
        }

        for (let r = 0; r < ringVertCount; r++) {
            const angle = (r / ringVertCount) * Math.PI * 2;
            const nx = Math.cos(angle);
            const nz = Math.sin(angle);
            const px = nx * radius;
            const pz = nz * radius;

            positions.push(px, y, pz);
            normals.push(nx, 0, nz);
            uvs.push(r / ringVertCount, t);
            joints.push(0, 1, 2, 0);
            weights.push(w0, w1, w2, 0);
        }
    }

    // Bottom vertex (index: totalRings * ringVertCount)
    const botIdx = totalRings * ringVertCount;
    positions.push(0, 0, 0);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0);
    joints.push(0, 1, 2, 0);
    weights.push(1.0, 0, 0, 0);

    // Top vertex (index: botIdx + 1)
    const topIdx = botIdx + 1;
    positions.push(0, height, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    joints.push(0, 1, 2, 0);
    weights.push(0, 0, 1.0, 0);

    const indices: number[] = [];

    // Cylinder quads
    for (let s = 0; s < segments; s++) {
        const ringA = s * ringVertCount;
        const ringB = (s + 1) * ringVertCount;

        for (let r = 0; r < ringVertCount; r++) {
            const nextR = (r + 1) % ringVertCount;
            const a0 = ringA + r;
            const a1 = ringA + nextR;
            const b0 = ringB + r;
            const b1 = ringB + nextR;

            indices.push(a0, b0, a1);
            indices.push(a1, b0, b1);
        }
    }

    // Bottom cap
    for (let r = 0; r < ringVertCount; r++) {
        const nextR = (r + 1) % ringVertCount;
        indices.push(botIdx, nextR, r);
    }

    // Top cap
    const topRingBase = segments * ringVertCount;
    for (let r = 0; r < ringVertCount; r++) {
        const nextR = (r + 1) % ringVertCount;
        indices.push(topIdx, topRingBase + r, topRingBase + nextR);
    }

    // Inverse bind matrices for 3 joints
    const invBind0 = Mat4.makeIdentity();
    const invBind1 = Mat4.makeIdentity();
    Mat4.translate(invBind1, Vec3(0, -1.0, 0), invBind1);
    const invBind2 = Mat4.makeIdentity();
    Mat4.translate(invBind2, Vec3(0, -2.0, 0), invBind2);

    const invBindFloats = new Float32Array(48);
    invBindFloats.set(invBind0, 0);
    invBindFloats.set(invBind1, 16);
    invBindFloats.set(invBind2, 32);

    // Encode Binary Buffers
    const posF32 = new Float32Array(positions);
    const normF32 = new Float32Array(normals);
    const uvF32 = new Float32Array(uvs);
    const jointsU16 = new Uint16Array(joints);
    const weightsF32 = new Float32Array(weights);
    const idxU16 = new Uint16Array(indices);

    // Calculate buffer layout with 4-byte alignments
    const align4 = (n: number) => Math.ceil(n / 4) * 4;

    const lenPos = align4(posF32.byteLength);
    const lenNorm = align4(normF32.byteLength);
    const lenUv = align4(uvF32.byteLength);
    const lenJoints = align4(jointsU16.byteLength);
    const lenWeights = align4(weightsF32.byteLength);
    const lenIdx = align4(idxU16.byteLength);
    const lenInvBind = align4(invBindFloats.byteLength);

    const totalBinLength =
        lenPos + lenNorm + lenUv + lenJoints + lenWeights + lenIdx + lenInvBind;

    const binBuffer = new ArrayBuffer(totalBinLength);
    const binU8 = new Uint8Array(binBuffer);

    let curOffset = 0;

    const offPos = curOffset;
    binU8.set(new Uint8Array(posF32.buffer), offPos);
    curOffset += lenPos;

    const offNorm = curOffset;
    binU8.set(new Uint8Array(normF32.buffer), offNorm);
    curOffset += lenNorm;

    const offUv = curOffset;
    binU8.set(new Uint8Array(uvF32.buffer), offUv);
    curOffset += lenUv;

    const offJoints = curOffset;
    binU8.set(new Uint8Array(jointsU16.buffer), offJoints);
    curOffset += lenJoints;

    const offWeights = curOffset;
    binU8.set(new Uint8Array(weightsF32.buffer), offWeights);
    curOffset += lenWeights;

    const offIdx = curOffset;
    binU8.set(new Uint8Array(idxU16.buffer), offIdx);
    curOffset += lenIdx;

    const offInvBind = curOffset;
    binU8.set(new Uint8Array(invBindFloats.buffer), offInvBind);
    curOffset += lenInvBind;

    const vertCount = totalVerts;
    const indexCount = indices.length;

    // Build glTF 2.0 JSON structure
    const gltfJson = {
        asset: { version: "2.0", generator: "WeebRender Procedural Rigged GLB" },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
            { name: "ArmModel", mesh: 0, skin: 0 },
            { name: "Joint_Base", translation: [0, 0, 0], children: [2] },
            { name: "Joint_Elbow", translation: [0, 1.0, 0], children: [3] },
            { name: "Joint_Claw", translation: [0, 1.0, 0] },
        ],
        skins: [
            {
                name: "RoboticArmRig",
                inverseBindMatrices: 6,
                joints: [1, 2, 3],
            },
        ],
        meshes: [
            {
                name: "RoboticArmMesh",
                primitives: [
                    {
                        attributes: {
                            POSITION: 0,
                            NORMAL: 1,
                            TEXCOORD_0: 2,
                            JOINTS_0: 3,
                            WEIGHTS_0: 4,
                        },
                        indices: 5,
                        material: 0,
                    },
                ],
            },
        ],
        materials: [
            {
                name: "RoboticChassis",
                pbrMetallicRoughness: {
                    baseColorFactor: [0.28, 0.72, 0.95, 1.0],
                    metallicFactor: 0.8,
                    roughnessFactor: 0.25,
                },
            },
        ],
        accessors: [
            // 0: POSITION
            { bufferView: 0, byteOffset: 0, componentType: 5126, count: vertCount, type: "VEC3" },
            // 1: NORMAL
            { bufferView: 1, byteOffset: 0, componentType: 5126, count: vertCount, type: "VEC3" },
            // 2: TEXCOORD_0
            { bufferView: 2, byteOffset: 0, componentType: 5126, count: vertCount, type: "VEC2" },
            // 3: JOINTS_0
            { bufferView: 3, byteOffset: 0, componentType: 5123, count: vertCount, type: "VEC4" },
            // 4: WEIGHTS_0
            { bufferView: 4, byteOffset: 0, componentType: 5126, count: vertCount, type: "VEC4" },
            // 5: INDICES
            { bufferView: 5, byteOffset: 0, componentType: 5123, count: indexCount, type: "SCALAR" },
            // 6: INVERSE BIND MATRICES
            { bufferView: 6, byteOffset: 0, componentType: 5126, count: 3, type: "MAT4" },
        ],
        bufferViews: [
            { buffer: 0, byteOffset: offPos, byteLength: posF32.byteLength },
            { buffer: 0, byteOffset: offNorm, byteLength: normF32.byteLength },
            { buffer: 0, byteOffset: offUv, byteLength: uvF32.byteLength },
            { buffer: 0, byteOffset: offJoints, byteLength: jointsU16.byteLength },
            { buffer: 0, byteOffset: offWeights, byteLength: weightsF32.byteLength },
            { buffer: 0, byteOffset: offIdx, byteLength: idxU16.byteLength },
            { buffer: 0, byteOffset: offInvBind, byteLength: invBindFloats.byteLength },
        ],
        buffers: [{ byteLength: totalBinLength }],
    };

    const jsonString = JSON.stringify(gltfJson);
    const jsonBytes = new TextEncoder().encode(jsonString);
    const jsonChunkLength = align4(jsonBytes.byteLength);
    const paddedJson = new Uint8Array(jsonChunkLength);
    paddedJson.set(jsonBytes);
    // Pad with space (0x20) per glTF specification
    for (let i = jsonBytes.byteLength; i < jsonChunkLength; i++) {
        paddedJson[i] = 0x20;
    }

    const binChunkLength = align4(totalBinLength);
    const paddedBin = new Uint8Array(binChunkLength);
    paddedBin.set(binU8);

    // Total GLB size: 12 (header) + 8 (chunk0 header) + jsonChunkLength + 8 (chunk1 header) + binChunkLength
    const totalGlbLength = 12 + 8 + jsonChunkLength + 8 + binChunkLength;

    const glbBuffer = new ArrayBuffer(totalGlbLength);
    const glbView = new DataView(glbBuffer);
    const glbU8 = new Uint8Array(glbBuffer);

    // 12-Byte Header
    glbView.setUint32(0, 0x46546c67, true); // 'glTF'
    glbView.setUint32(4, 2, true);          // version 2
    glbView.setUint32(8, totalGlbLength, true);

    // Chunk 0 (JSON)
    let wOffset = 12;
    glbView.setUint32(wOffset, jsonChunkLength, true);
    glbView.setUint32(wOffset + 4, 0x4e4f534a, true); // 'JSON'
    wOffset += 8;
    glbU8.set(paddedJson, wOffset);
    wOffset += jsonChunkLength;

    // Chunk 1 (BIN)
    glbView.setUint32(wOffset, binChunkLength, true);
    glbView.setUint32(wOffset + 4, 0x004e4942, true); // 'BIN\0'
    wOffset += 8;
    glbU8.set(paddedBin, wOffset);

    return glbBuffer;
}
