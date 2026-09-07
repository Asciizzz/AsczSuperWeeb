import { Mesh, type Submesh, type VertexAttribute } from "../mesh.js";
import { Texture } from "../texture.js";
import { Skeleton, type Joint } from "../skeleton.js";
import { Mat4, Vec3, Quat } from "../../Atoolkit/alm/index.js";

export const STANDARD_ATTRIBUTES: VertexAttribute[] = [
    { name: "POSITION", format: "float32x3", offset: 0, shaderLocation: 0 },
    { name: "NORMAL", format: "float32x3", offset: 12, shaderLocation: 1 },
    { name: "TEXCOORD_0", format: "float32x2", offset: 24, shaderLocation: 2 },
];

export const SKINNED_ATTRIBUTES: VertexAttribute[] = [
    { name: "POSITION", format: "float32x3", offset: 0, shaderLocation: 0 },
    { name: "NORMAL", format: "float32x3", offset: 12, shaderLocation: 1 },
    { name: "TEXCOORD_0", format: "float32x2", offset: 24, shaderLocation: 2 },
    { name: "JOINTS_0", format: "uint32x4", offset: 32, shaderLocation: 3 },
    { name: "WEIGHTS_0", format: "float32x4", offset: 48, shaderLocation: 4 },
];

/**
 * Creates an empty static Mesh asset with standard attribute layout.
 */
export function createEmptyMesh(name = "EmptyMesh"): Mesh {
    return new Mesh(
        name,
        new Float32Array(0),
        new Uint16Array(0),
        [],
        32,
        STANDARD_ATTRIBUTES
    );
}

/**
 * Procedural generator for a 3D box mesh.
 */
export function createBoxMesh(
    name = "Box",
    width = 1,
    height = 1,
    depth = 1
): Mesh {
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    const vertices: number[] = [
        // +Z Front face
        -hw, -hh,  hd,  0, 0, 1,  0, 1,
         hw, -hh,  hd,  0, 0, 1,  1, 1,
         hw,  hh,  hd,  0, 0, 1,  1, 0,
        -hw,  hh,  hd,  0, 0, 1,  0, 0,
        // -Z Back face
         hw, -hh, -hd,  0, 0, -1,  0, 1,
        -hw, -hh, -hd,  0, 0, -1,  1, 1,
        -hw,  hh, -hd,  0, 0, -1,  1, 0,
         hw,  hh, -hd,  0, 0, -1,  0, 0,
        // +X Right face
         hw, -hh,  hd,  1, 0, 0,  0, 1,
         hw, -hh, -hd,  1, 0, 0,  1, 1,
         hw,  hh, -hd,  1, 0, 0,  1, 0,
         hw,  hh,  hd,  1, 0, 0,  0, 0,
        // -X Left face
        -hw, -hh, -hd,  -1, 0, 0,  0, 1,
        -hw, -hh,  hd,  -1, 0, 0,  1, 1,
        -hw,  hh,  hd,  -1, 0, 0,  1, 0,
        -hw,  hh, -hd,  -1, 0, 0,  0, 0,
        // +Y Top face
        -hw,  hh,  hd,  0, 1, 0,  0, 1,
         hw,  hh,  hd,  0, 1, 0,  1, 1,
         hw,  hh, -hd,  0, 1, 0,  1, 0,
        -hw,  hh, -hd,  0, 1, 0,  0, 0,
        // -Y Bottom face
        -hw, -hh, -hd,  0, -1, 0,  0, 1,
         hw, -hh, -hd,  0, -1, 0,  1, 1,
         hw, -hh,  hd,  0, -1, 0,  1, 0,
        -hw, -hh,  hd,  0, -1, 0,  0, 0,
    ];

    const indices: number[] = [];
    for (let i = 0; i < 6; i++) {
        const offset = i * 4;
        indices.push(
            offset, offset + 1, offset + 2,
            offset, offset + 2, offset + 3
        );
    }

    const submeshes: Submesh[] = [{
        name: "BoxMain",
        indexStart: 0,
        indexCount: indices.length,
    }];

    return new Mesh(
        name,
        new Float32Array(vertices),
        new Uint16Array(indices),
        submeshes,
        32,
        STANDARD_ATTRIBUTES
    );
}

/**
 * Procedural generator for a planar grid mesh.
 */
export function createPlaneMesh(
    name = "Plane",
    width = 10,
    depth = 10,
    segmentsX = 1,
    segmentsZ = 1
): Mesh {
    const hw = width / 2;
    const hd = depth / 2;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let z = 0; z <= segmentsZ; z++) {
        const fz = z / segmentsZ;
        const posZ = -hd + fz * depth;
        for (let x = 0; x <= segmentsX; x++) {
            const fx = x / segmentsX;
            const posX = -hw + fx * width;
            vertices.push(
                posX, 0, posZ, // Position
                0, 1, 0,       // Normal
                fx, fz         // UV
            );
        }
    }

    const strideRow = segmentsX + 1;
    for (let z = 0; z < segmentsZ; z++) {
        for (let x = 0; x < segmentsX; x++) {
            const i0 = z * strideRow + x;
            const i1 = i0 + 1;
            const i2 = (z + 1) * strideRow + x;
            const i3 = i2 + 1;
            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }
    }

    const submeshes: Submesh[] = [{
        name: "PlaneMain",
        indexStart: 0,
        indexCount: indices.length,
    }];

    return new Mesh(
        name,
        new Float32Array(vertices),
        new Uint16Array(indices),
        submeshes,
        32,
        STANDARD_ATTRIBUTES
    );
}

/**
 * Procedural generator for a UV sphere mesh.
 */
export function createSphereMesh(
    name = "Sphere",
    radius = 1,
    segments = 16,
    rings = 12
): Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= rings; y++) {
        const v = y / rings;
        const phi = v * Math.PI;
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);

        for (let x = 0; x <= segments; x++) {
            const u = x / segments;
            const theta = u * Math.PI * 2;
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);

            const nx = sinPhi * cosTheta;
            const ny = cosPhi;
            const nz = sinPhi * sinTheta;

            vertices.push(
                nx * radius, ny * radius, nz * radius,
                nx, ny, nz,
                u, v
            );
        }
    }

    const strideRow = segments + 1;
    for (let y = 0; y < rings; y++) {
        for (let x = 0; x < segments; x++) {
            const i0 = y * strideRow + x;
            const i1 = i0 + 1;
            const i2 = (y + 1) * strideRow + x;
            const i3 = i2 + 1;

            if (y !== 0) {
                indices.push(i0, i2, i1);
            }
            if (y !== rings - 1) {
                indices.push(i1, i2, i3);
            }
        }
    }

    const submeshes: Submesh[] = [{
        name: "SphereMain",
        indexStart: 0,
        indexCount: indices.length,
    }];

    return new Mesh(
        name,
        new Float32Array(vertices),
        new Uint16Array(indices),
        submeshes,
        32,
        STANDARD_ATTRIBUTES
    );
}

/**
 * Procedural generator for a 2D checkerboard texture preset.
 */
export function createCheckerTexture(
    width = 64,
    height = 64,
    colorA = [255, 255, 255, 255],
    colorB = [0, 0, 0, 255],
    checkSize = 8,
    name = "CheckerTexture"
): Texture {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const isA = (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
            const color = isA ? colorA : colorB;
            data[idx + 0] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
    }
    return new Texture(name, width, height, data);
}

/**
 * Creates a single-pixel solid color texture preset.
 */
export function createSolidColorTexture(
    r = 255,
    g = 255,
    b = 255,
    a = 255,
    name = "SolidColorTexture"
): Texture {
    const data = new Uint8Array([r, g, b, a]);
    return new Texture(name, 1, 1, data);
}

/**
 * Helper to create an empty skeleton with N joints.
 */
export function createEmptySkeleton(name = "Skeleton", jointCount = 1): Skeleton {
    const joints: Joint[] = [];
    for (let i = 0; i < jointCount; i++) {
        joints.push({
            name: `Joint_${i}`,
            parentIndex: i === 0 ? -1 : 0,
            invBindMatrix: Mat4.makeIdentity(),
            localTransform: {
                position: Vec3(0, 0, 0),
                rotation: Quat.makeIdentity(),
                scale: Vec3(1, 1, 1),
            },
        });
    }
    return new Skeleton(name, joints);
}

/**
 * Creates a two-bone skeleton chain.
 * Bone 0 at base (0, 0, 0), Bone 1 at (0, height / 2, 0).
 */
export function createTwoBoneSkeleton(name = "TwoBoneRig", height = 2.0): Skeleton {
    const invBind0 = Mat4.makeIdentity();
    const invBind1 = Mat4.makeIdentity();
    Mat4.translate(invBind1, Vec3(0, -(height / 2), 0), invBind1);

    const joints: Joint[] = [
        {
            name: "Bone_Base",
            parentIndex: -1,
            invBindMatrix: invBind0,
            localTransform: {
                position: Vec3(0, 0, 0),
                rotation: Quat.makeIdentity(),
                scale: Vec3(1, 1, 1),
            },
        },
        {
            name: "Bone_Tip",
            parentIndex: 0,
            invBindMatrix: invBind1,
            localTransform: {
                position: Vec3(0, height / 2, 0),
                rotation: Quat.makeIdentity(),
                scale: Vec3(1, 1, 1),
            },
        },
    ];

    return new Skeleton(name, joints);
}

/**
 * Procedural generator for a vertical skinned bar mesh with height segments.
 * Skinned to 2 bones: Joint 0 at base (y=0) and Joint 1 at top (y=height).
 * Stride is 64 bytes with SKINNED_ATTRIBUTES.
 */
export function createSkinnedBarMesh(
    name = "SkinnedBar",
    width = 0.5,
    height = 2.0,
    depth = 0.5,
    segmentsY = 8
): Mesh {
    const hw = width / 2;
    const hd = depth / 2;
    const stride = 64; // 16 words of 4 bytes each

    // Positions of the 4 corners in XZ plane
    const corners = [
        [-hw, -hd],
        [ hw, -hd],
        [ hw,  hd],
        [-hw,  hd],
    ];

    const verticesList: number[] = [];
    const jointsList: number[] = [];
    const weightsList: number[] = [];

    function addV(
        px: number, py: number, pz: number,
        nx: number, ny: number, nz: number,
        u: number, v: number,
        j0: number, j1: number,
        w0: number, w1: number
    ): number {
        const idx = verticesList.length / 8;
        verticesList.push(px, py, pz, nx, ny, nz, u, v);
        jointsList.push(j0, j1, 0, 0);
        weightsList.push(w0, w1, 0, 0);
        return idx;
    }

    const indices: number[] = [];
    const ringBaseIndices: number[] = [];

    // Build rings along Y
    for (let s = 0; s <= segmentsY; s++) {
        const t = s / segmentsY;
        const y = t * height;
        const w1 = t;
        const w0 = 1.0 - t;

        const ringStart = verticesList.length / 8;
        ringBaseIndices.push(ringStart);

        for (let c = 0; c < 4; c++) {
            const [cx, cz] = corners[c];
            const len = Math.hypot(cx, cz) || 1;
            addV(cx, y, cz, cx / len, 0, cz / len, c / 4, t, 0, 1, w0, w1);
        }
    }

    // Connect rings with quads
    for (let s = 0; s < segmentsY; s++) {
        const ringA = ringBaseIndices[s];
        const ringB = ringBaseIndices[s + 1];

        for (let c = 0; c < 4; c++) {
            const nextC = (c + 1) % 4;
            const a0 = ringA + c;
            const a1 = ringA + nextC;
            const b0 = ringB + c;
            const b1 = ringB + nextC;

            indices.push(a0, b0, a1);
            indices.push(a1, b0, b1);
        }
    }

    // Bottom cap (y = 0, normal [0, -1, 0], w0=1, w1=0)
    const botStart = verticesList.length / 8;
    for (let c = 0; c < 4; c++) {
        const [cx, cz] = corners[c];
        addV(cx, 0, cz, 0, -1, 0, cx / width + 0.5, cz / depth + 0.5, 0, 1, 1.0, 0.0);
    }
    indices.push(botStart + 0, botStart + 1, botStart + 2);
    indices.push(botStart + 0, botStart + 2, botStart + 3);

    // Top cap (y = height, normal [0, 1, 0], w0=0, w1=1)
    const topStart = verticesList.length / 8;
    for (let c = 0; c < 4; c++) {
        const [cx, cz] = corners[c];
        addV(cx, height, cz, 0, 1, 0, cx / width + 0.5, cz / depth + 0.5, 0, 1, 0.0, 1.0);
    }
    indices.push(topStart + 0, topStart + 3, topStart + 2);
    indices.push(topStart + 0, topStart + 2, topStart + 1);

    const totalVerts = verticesList.length / 8;
    const buffer = new ArrayBuffer(totalVerts * stride);
    const f32 = new Float32Array(buffer);
    const u32 = new Uint32Array(buffer);

    for (let i = 0; i < totalVerts; i++) {
        const base = i * 16;
        const vBase = i * 8;
        const jBase = i * 4;
        const wBase = i * 4;

        // pos, norm, uv
        f32[base + 0] = verticesList[vBase + 0];
        f32[base + 1] = verticesList[vBase + 1];
        f32[base + 2] = verticesList[vBase + 2];
        f32[base + 3] = verticesList[vBase + 3];
        f32[base + 4] = verticesList[vBase + 4];
        f32[base + 5] = verticesList[vBase + 5];
        f32[base + 6] = verticesList[vBase + 6];
        f32[base + 7] = verticesList[vBase + 7];

        // joints (uint32)
        u32[base + 8] = jointsList[jBase + 0];
        u32[base + 9] = jointsList[jBase + 1];
        u32[base + 10] = jointsList[jBase + 2];
        u32[base + 11] = jointsList[jBase + 3];

        // weights (float32)
        f32[base + 12] = weightsList[wBase + 0];
        f32[base + 13] = weightsList[wBase + 1];
        f32[base + 14] = weightsList[wBase + 2];
        f32[base + 15] = weightsList[wBase + 3];
    }

    const submesh: Submesh = {
        name: "SkinnedBar",
        indexStart: 0,
        indexCount: indices.length,
    };

    return new Mesh(
        name,
        f32,
        new Uint16Array(indices),
        [submesh],
        stride,
        SKINNED_ATTRIBUTES
    );
}
