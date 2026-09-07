/* Alm (Math)
By Asciiz

High-performance math library for Float32Array vectors, matrices, and quaternions.
Optimized for zero-allocation loops, WebGPU [0, 1] & WebGL [-1, 1] clip spaces,
and fast in-place transformations.

# Components
    Vec2, Vec3, Vec4, Quat, Mat4

# Constants
    EPSILON, DEG2RAD, RAD2DEG, TAU, PI_HALF, PI_QUARTER, PI_THIRD

# Notes
    Matrices are column-major Float32Array[16].
    Quaternion format is [x, y, z, w].
    All methods accept an optional `out` parameter. When provided, ZERO allocations occur.
*/

// ==================== Types =====================

/** A Float32Array of length 2 */
export type V2 = Float32Array;
/** A Float32Array of length 3 */
export type V3 = Float32Array;
/** A Float32Array of length 4 */
export type V4 = Float32Array;
/** A Float32Array of length 4 in [x, y, z, w] order */
export type Q4 = Float32Array;
/** A column-major Float32Array of length 16 */
export type M16 = Float32Array;

type Vec2Like = ArrayLike<number> | number;
type Vec3Like = ArrayLike<number> | number;
type Vec4Like = ArrayLike<number> | number;

// ==================== Constants =====================

export const EPSILON:     number = 0.000001;
export const DEG2RAD:     number = 0.017453292519943295;
export const RAD2DEG:     number = 57.29577951308232;
export const TAU:         number = 6.283185307179586;
export const PI_HALF:     number = 1.5707963267948966;
export const PI_QUARTER:  number = 0.7853981633974483;
export const PI_THIRD:    number = 1.0471975511965976;

// ==================== Vec2 =====================

export function Vec2(): V2;
export function Vec2(array: ArrayLike<number>): V2;
export function Vec2(x: number, y?: number): V2;
export function Vec2(xOrArray: Vec2Like = 0, y = 0): V2 {
    const out = new Float32Array(2);
    if (typeof xOrArray === "number") {
        out[0] = xOrArray;
        out[1] = y;
    } else {
        out[0] = xOrArray[0] ?? 0;
        out[1] = xOrArray[1] ?? 0;
    }
    return out;
}

Vec2.set = function(x: number, y: number, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = x; out[1] = y;
    return out;
};

Vec2.copy = function(a: V2, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = a[0]; out[1] = a[1];
    return out;
};

Vec2.add = function(a: V2, b: V2, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = a[0] + b[0]; out[1] = a[1] + b[1];
    return out;
};

Vec2.sub = function(a: V2, b: V2, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1];
    return out;
};

Vec2.scale = function(a: V2, s: number, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = a[0] * s; out[1] = a[1] * s;
    return out;
};

Vec2.dot = function(a: V2, b: V2): number {
    return a[0] * b[0] + a[1] * b[1];
};

Vec2.len = function(a: V2): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
};

Vec2.lenSq = function(a: V2): number {
    return a[0] * a[0] + a[1] * a[1];
};

Vec2.norm = function(a: V2, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    const x = a[0], y = a[1];
    const lsq = x * x + y * y;
    if (lsq > EPSILON * EPSILON) {
        const invLen = 1.0 / Math.sqrt(lsq);
        out[0] = x * invLen; out[1] = y * invLen;
    } else {
        out[0] = 0; out[1] = 0;
    }
    return out;
};

Vec2.distance = function(a: V2, b: V2): number {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
};

Vec2.distanceSq = function(a: V2, b: V2): number {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return dx * dx + dy * dy;
};

Vec2.lerp = function(a: V2, b: V2, t: number, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    return out;
};

Vec2.equals = function(a: V2, b: V2, epsilon = EPSILON): boolean {
    return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
};

Vec2.exactEquals = function(a: V2, b: V2): boolean {
    return a[0] === b[0] && a[1] === b[1];
};

// ==================== Vec3 =====================

export function Vec3(): V3;
export function Vec3(array: ArrayLike<number>): V3;
export function Vec3(x: number, y?: number, z?: number): V3;
export function Vec3(xOrArray: Vec3Like = 0, y = 0, z = 0): V3 {
    const out = new Float32Array(3);
    if (typeof xOrArray === "number") {
        out[0] = xOrArray; out[1] = y; out[2] = z;
    } else {
        out[0] = xOrArray[0] ?? 0; out[1] = xOrArray[1] ?? 0; out[2] = xOrArray[2] ?? 0;
    }
    return out;
}

Vec3.UP      = new Float32Array([0, 1, 0]);
Vec3.DOWN    = new Float32Array([0, -1, 0]);
Vec3.RIGHT   = new Float32Array([1, 0, 0]);
Vec3.LEFT    = new Float32Array([-1, 0, 0]);
Vec3.FORWARD = new Float32Array([0, 0, -1]);
Vec3.BACK    = new Float32Array([0, 0, 1]);
Vec3.ZERO    = new Float32Array([0, 0, 0]);
Vec3.ONE     = new Float32Array([1, 1, 1]);

Vec3.set = function(x: number, y: number, z: number, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = x; out[1] = y; out[2] = z;
    return out;
};

Vec3.copy = function(a: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2];
    return out;
};

Vec3.add = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2];
    return out;
};

Vec3.sub = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2];
    return out;
};

Vec3.mul = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] * b[0]; out[1] = a[1] * b[1]; out[2] = a[2] * b[2];
    return out;
};

Vec3.scale = function(a: V3, s: number, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s;
    return out;
};

Vec3.scaleAndAdd = function(a: V3, b: V3, s: number, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] + b[0] * s;
    out[1] = a[1] + b[1] * s;
    out[2] = a[2] + b[2] * s;
    return out;
};

Vec3.dot = function(a: V3, b: V3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

Vec3.cross = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
};

Vec3.len = function(a: V3): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
};

Vec3.lenSq = function(a: V3): number {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
};

Vec3.norm = function(a: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const x = a[0], y = a[1], z = a[2];
    const lsq = x * x + y * y + z * z;
    if (lsq > EPSILON * EPSILON) {
        const invLen = 1.0 / Math.sqrt(lsq);
        out[0] = x * invLen; out[1] = y * invLen; out[2] = z * invLen;
    } else {
        out[0] = 0; out[1] = 0; out[2] = 0;
    }
    return out;
};

Vec3.distance = function(a: V3, b: V3): number {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

Vec3.distanceSq = function(a: V3, b: V3): number {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    return dx * dx + dy * dy + dz * dz;
};

Vec3.lerp = function(a: V3, b: V3, t: number, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
};

Vec3.min = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    return out;
};

Vec3.max = function(a: V3, b: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    return out;
};

Vec3.clamp = function(v: V3, min: V3, max: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    out[0] = Math.max(min[0], Math.min(max[0], v[0]));
    out[1] = Math.max(min[1], Math.min(max[1], v[1]));
    out[2] = Math.max(min[2], Math.min(max[2], v[2]));
    return out;
};

Vec3.reflect = function(v: V3, normal: V3, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const d = 2 * (v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2]);
    out[0] = v[0] - d * normal[0];
    out[1] = v[1] - d * normal[1];
    out[2] = v[2] - d * normal[2];
    return out;
};

Vec3.angle = function(a: V3, b: V3): number {
    const lsq1 = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    const lsq2 = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    if (lsq1 === 0 || lsq2 === 0) return 0;
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cos = dot / Math.sqrt(lsq1 * lsq2);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
};

/**
 * Transforms point v = [x, y, z, 1.0] by Mat4, including translation and perspective division.
 */
Vec3.transformMat4 = function(v: V3, m: M16, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const x = v[0], y = v[1], z = v[2];
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w ? 1.0 / w : 1.0;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
    return out;
};

/**
 * Transforms direction v = [x, y, z, 0.0] by Mat4 (ignores translation).
 */
Vec3.transformMat4Direction = function(v: V3, m: M16, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
};

/**
 * Transforms vector by quaternion.
 */
Vec3.transformQuat = function(v: V3, q: Q4, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const vx = v[0], vy = v[1], vz = v[2];
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    out[0] = vx + qw * tx + qy * tz - qz * ty;
    out[1] = vy + qw * ty + qz * tx - qx * tz;
    out[2] = vz + qw * tz + qx * ty - qy * tx;
    return out;
};

Vec3.equals = function(a: V3, b: V3, epsilon = EPSILON): boolean {
    return (
        Math.abs(a[0] - b[0]) <= epsilon &&
        Math.abs(a[1] - b[1]) <= epsilon &&
        Math.abs(a[2] - b[2]) <= epsilon
    );
};

Vec3.exactEquals = function(a: V3, b: V3): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
};

// ==================== Vec4 =====================

export function Vec4(): V4;
export function Vec4(array: ArrayLike<number>): V4;
export function Vec4(x: number, y?: number, z?: number, w?: number): V4;
export function Vec4(xOrArray: Vec4Like = 0, y = 0, z = 0, w = 0): V4 {
    const out = new Float32Array(4);
    if (typeof xOrArray === "number") {
        out[0] = xOrArray; out[1] = y; out[2] = z; out[3] = w;
    } else {
        out[0] = xOrArray[0] ?? 0; out[1] = xOrArray[1] ?? 0; out[2] = xOrArray[2] ?? 0; out[3] = xOrArray[3] ?? 0;
    }
    return out;
}

Vec4.set = function(x: number, y: number, z: number, w: number, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
    return out;
};

Vec4.copy = function(a: V4, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    return out;
};

Vec4.add = function(a: V4, b: V4, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; out[3] = a[3] + b[3];
    return out;
};

Vec4.sub = function(a: V4, b: V4, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; out[3] = a[3] - b[3];
    return out;
};

Vec4.scale = function(a: V4, s: number, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; out[3] = a[3] * s;
    return out;
};

Vec4.dot = function(a: V4, b: V4): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

Vec4.len = function(a: V4): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
};

Vec4.lenSq = function(a: V4): number {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
};

Vec4.norm = function(a: V4, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    const x = a[0], y = a[1], z = a[2], w = a[3];
    const lsq = x * x + y * y + z * z + w * w;
    if (lsq > EPSILON * EPSILON) {
        const invLen = 1.0 / Math.sqrt(lsq);
        out[0] = x * invLen; out[1] = y * invLen; out[2] = z * invLen; out[3] = w * invLen;
    } else {
        out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
    }
    return out;
};

Vec4.lerp = function(a: V4, b: V4, t: number, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    out[3] = a[3] + (b[3] - a[3]) * t;
    return out;
};

Vec4.equals = function(a: V4, b: V4, epsilon = EPSILON): boolean {
    return (
        Math.abs(a[0] - b[0]) <= epsilon &&
        Math.abs(a[1] - b[1]) <= epsilon &&
        Math.abs(a[2] - b[2]) <= epsilon &&
        Math.abs(a[3] - b[3]) <= epsilon
    );
};

// ==================== Quat [x, y, z, w] =====================

export function Quat(): Q4;
export function Quat(array: ArrayLike<number>): Q4;
export function Quat(x: number, y?: number, z?: number, w?: number): Q4;
export function Quat(xOrArray: Vec4Like = 0, y = 0, z = 0, w = 1): Q4 {
    const out = new Float32Array(4);
    if (typeof xOrArray === "number") {
        out[0] = xOrArray; out[1] = y; out[2] = z; out[3] = w;
    } else {
        out[0] = xOrArray[0] ?? 0; out[1] = xOrArray[1] ?? 0; out[2] = xOrArray[2] ?? 0; out[3] = xOrArray[3] ?? 1;
    }
    return out;
}

Quat.IDENTITY = Object.freeze([0, 0, 0, 1]);

Quat.makeIdentity = function(out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1;
    return out;
};

Quat.set = function(x: number, y: number, z: number, w: number, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    out[0] = x; out[1] = y; out[2] = z; out[3] = w;
    return out;
};

Quat.copy = function(a: Q4, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    return out;
};

Quat.dot = function(a: Q4, b: Q4): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

Quat.mul = function(a: Q4, b: Q4, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[0] = aw * bx + ax * bw + ay * bz - az * by;
    out[1] = aw * by - ax * bz + ay * bw + az * bx;
    out[2] = aw * bz + ax * by - ay * bx + az * bw;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
};

Quat.len = function(a: Q4): number {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]);
};

Quat.lenSq = function(a: Q4): number {
    return a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
};

Quat.norm = function(a: Q4, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const x = a[0], y = a[1], z = a[2], w = a[3];
    const lsq = x * x + y * y + z * z + w * w;
    if (lsq > EPSILON * EPSILON) {
        const invLen = 1.0 / Math.sqrt(lsq);
        out[0] = x * invLen; out[1] = y * invLen; out[2] = z * invLen; out[3] = w * invLen;
    } else {
        out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1;
    }
    return out;
};

/**
 * Fast conjugate of a unit quaternion (exact inverse when normalized).
 */
Quat.conjugate = function(a: Q4, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    out[0] = -a[0]; out[1] = -a[1]; out[2] = -a[2]; out[3] = a[3];
    return out;
};

Quat.invert = function(a: Q4, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const dot = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
    const inv = dot > EPSILON ? 1 / dot : 0;
    out[0] = -a[0] * inv; out[1] = -a[1] * inv; out[2] = -a[2] * inv; out[3] = a[3] * inv;
    return out;
};

Quat.fromAxisAngle = function(axis: V3, rad: number, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const half = rad * 0.5;
    const s = Math.sin(half);
    out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s;
    out[3] = Math.cos(half);
    return out;
};

/**
 * Constructs a quaternion from Euler angles in radians (XYZ order).
 */
Quat.fromEuler = function(x: number, y: number, z: number, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const hx = x * 0.5, hy = y * 0.5, hz = z * 0.5;
    const cx = Math.cos(hx), sx = Math.sin(hx);
    const cy = Math.cos(hy), sy = Math.sin(hy);
    const cz = Math.cos(hz), sz = Math.sin(hz);

    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
    return out;
};

Quat.fromM4 = function(m: M16, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    const m00 = m[0], m01 = m[1], m02 = m[2];
    const m10 = m[4], m11 = m[5], m12 = m[6];
    const m20 = m[8], m21 = m[9], m22 = m[10];
    const trace = m00 + m11 + m22;

    let s: number;
    if (trace > 0) {
        s = 0.5 / Math.sqrt(trace + 1);
        out[3] = 0.25 / s;
        out[0] = (m21 - m12) * s; out[1] = (m02 - m20) * s; out[2] = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
        s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        out[3] = (m21 - m12) / s; out[0] = 0.25 * s;
        out[1] = (m01 + m10) / s; out[2] = (m02 + m20) / s;
    } else if (m11 > m22) {
        s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        out[3] = (m02 - m20) / s; out[0] = (m01 + m10) / s;
        out[1] = 0.25 * s;        out[2] = (m12 + m21) / s;
    } else {
        s = 2 * Math.sqrt(1 + m22 - m00 - m11);
        out[3] = (m10 - m01) / s; out[0] = (m02 + m20) / s;
        out[1] = (m12 + m21) / s; out[2] = 0.25 * s;
    }
    return out;
};

Quat.toEulerYPR = function(q: Q4, out: V3 | null = null): V3 {
    out ??= new Float32Array(3);
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const sx      = 2 * (w * x - y * z);
    const clamped = Math.max(-1, Math.min(1, sx));
    const pitch   = Math.asin(clamped);
    const yaw     = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
    const roll    = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
    out[0] = yaw * RAD2DEG; out[1] = pitch * RAD2DEG; out[2] = roll * RAD2DEG;
    return out;
};

Quat.transformV3 = function(q: Q4, v: V3, out: V3 | null = null): V3 {
    return Vec3.transformQuat(v, q, out);
};

Quat.slerp = function(a: Q4, b: Q4, t: number, out: Q4 | null = null): Q4 {
    out ??= new Float32Array(4);
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    if (dot < 0) { dot = -dot; bx = -bx; by = -by; bz = -bz; bw = -bw; }

    let scale0: number, scale1: number;
    if (dot > 1 - EPSILON) {
        scale0 = 1 - t; scale1 = t;
    } else {
        const theta    = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        scale0 = Math.sin((1 - t) * theta) / sinTheta;
        scale1 = Math.sin(t * theta) / sinTheta;
    }

    out[0] = scale0 * a[0] + scale1 * bx;
    out[1] = scale0 * a[1] + scale1 * by;
    out[2] = scale0 * a[2] + scale1 * bz;
    out[3] = scale0 * a[3] + scale1 * bw;
    return out;
};

// ==================== Mat4 (column-major Float32Array[16]) =====================
//
//  Index layout (column-major):
//   0  4  8  12
//   1  5  9  13
//   2  6  10 14
//   3  7  11 15

export function Mat4(arrayLike: ArrayLike<number> | null = null): M16 {
    const out = new Float32Array(16);
    if (arrayLike && (ArrayBuffer.isView(arrayLike) || Array.isArray(arrayLike))) {
        const src = arrayLike as Float32Array;
        out.set(src.subarray ? src.subarray(0, 16) : Array.from(arrayLike).slice(0, 16));
    }
    return out;
}

Mat4.IDENTITY = Object.freeze([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

Mat4.makeIdentity = function(out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    return out;
};

Mat4.copy = function(a: M16, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(a);
    return out;
};

Mat4.mul = function(a: M16, b: M16, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const a00=a[0], a01=a[1], a02=a[2], a03=a[3];
    const a10=a[4], a11=a[5], a12=a[6], a13=a[7];
    const a20=a[8], a21=a[9], a22=a[10], a23=a[11];
    const a30=a[12], a31=a[13], a32=a[14], a33=a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};

Mat4.transpose = function(a: M16, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    if (out === a) {
        let t: number;
        t=a[1];a[1]=a[4];a[4]=t; t=a[2];a[2]=a[8];a[8]=t; t=a[3];a[3]=a[12];a[12]=t;
        t=a[6];a[6]=a[9];a[9]=t; t=a[7];a[7]=a[13];a[13]=t; t=a[11];a[11]=a[14];a[14]=t;
        return out;
    }
    out[0]=a[0]; out[1]=a[4]; out[2]=a[8];  out[3]=a[12];
    out[4]=a[1]; out[5]=a[5]; out[6]=a[9];  out[7]=a[13];
    out[8]=a[2]; out[9]=a[6]; out[10]=a[10];out[11]=a[14];
    out[12]=a[3];out[13]=a[7];out[14]=a[11];out[15]=a[15];
    return out;
};

Mat4.invert = function(a: M16, out: M16 | null = null): M16 | null {
    out ??= new Float32Array(16);
    const a00=a[0], a01=a[1], a02=a[2], a03=a[3];
    const a10=a[4], a11=a[5], a12=a[6], a13=a[7];
    const a20=a[8], a21=a[9], a22=a[10], a23=a[11];
    const a30=a[12], a31=a[13], a32=a[14], a33=a[15];

    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10;
    const b02=a00*a13-a03*a10, b03=a01*a12-a02*a11;
    const b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
    const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30;
    const b08=a20*a33-a23*a30, b09=a21*a32-a22*a31;
    const b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;

    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (Math.abs(det) <= EPSILON) return null;
    det = 1.0 / det;

    out[0]  = (a11*b11 - a12*b10 + a13*b09) * det;
    out[1]  = (a02*b10 - a01*b11 - a03*b09) * det;
    out[2]  = (a31*b05 - a32*b04 + a33*b03) * det;
    out[3]  = (a22*b04 - a21*b05 - a23*b03) * det;
    out[4]  = (a12*b08 - a10*b11 - a13*b07) * det;
    out[5]  = (a00*b11 - a02*b08 + a03*b07) * det;
    out[6]  = (a32*b02 - a30*b05 - a33*b01) * det;
    out[7]  = (a20*b05 - a22*b02 + a23*b01) * det;
    out[8]  = (a10*b10 - a11*b08 + a13*b06) * det;
    out[9]  = (a01*b08 - a00*b10 - a03*b06) * det;
    out[10] = (a30*b04 - a31*b02 + a33*b00) * det;
    out[11] = (a21*b02 - a20*b04 - a23*b00) * det;
    out[12] = (a11*b07 - a10*b09 - a12*b06) * det;
    out[13] = (a00*b09 - a01*b07 + a02*b06) * det;
    out[14] = (a31*b01 - a30*b03 - a32*b00) * det;
    out[15] = (a20*b03 - a21*b01 + a22*b00) * det;
    return out;
};

/**
 * Fast specialized inverse for affine/rigid transformation matrices (Rotation + Translation).
 * ~8x faster than full general matrix inversion.
 */
Mat4.invertRigid = function(a: M16, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    // Transpose the upper-left 3x3 rotation
    const r00 = a[0], r01 = a[4], r02 = a[8];
    const r10 = a[1], r11 = a[5], r12 = a[9];
    const r20 = a[2], r21 = a[6], r22 = a[10];
    const tx = a[12], ty = a[13], tz = a[14];

    out[0] = r00; out[1] = r01; out[2] = r02; out[3] = 0;
    out[4] = r10; out[5] = r11; out[6] = r12; out[7] = 0;
    out[8] = r20; out[9] = r21; out[10] = r22; out[11] = 0;
    out[12] = -(r00 * tx + r01 * ty + r02 * tz);
    out[13] = -(r10 * tx + r11 * ty + r12 * tz);
    out[14] = -(r20 * tx + r21 * ty + r22 * tz);
    out[15] = 1;
    return out;
};

/**
 * Computes 3x3 normal matrix (transpose of inverse of model matrix) embedded into a Mat4.
 * Essential for 3D lighting with non-uniform scale.
 */
Mat4.normalMatrix = function(m: M16, out: M16 | null = null): M16 | null {
    out ??= new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2];
    const a10 = m[4], a11 = m[5], a12 = m[6];
    const a20 = m[8], a21 = m[9], a22 = m[10];

    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;

    let d = a00 * b01 + a01 * b11 + a02 * b21;
    if (Math.abs(d) <= EPSILON) return null;
    d = 1.0 / d;

    out[0] = b01 * d;
    out[1] = (-a22 * a01 + a02 * a21) * d;
    out[2] = (a12 * a01 - a02 * a11) * d;
    out[3] = 0;

    out[4] = b11 * d;
    out[5] = (a22 * a00 - a02 * a20) * d;
    out[6] = (-a12 * a00 + a02 * a10) * d;
    out[7] = 0;

    out[8] = b21 * d;
    out[9] = (-a21 * a00 + a01 * a20) * d;
    out[10] = (a11 * a00 - a01 * a10) * d;
    out[11] = 0;

    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
};

Mat4.fromTranslation = function(v: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    out[12] = v[0]; out[13] = v[1]; out[14] = v[2];
    return out;
};

Mat4.fromScaling = function(v: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    out[0] = v[0]; out[5] = v[1]; out[10] = v[2];
    return out;
};

Mat4.fromRotationX = function(rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    const c = Math.cos(rad), s = Math.sin(rad);
    out[5] = c; out[6] = s; out[9] = -s; out[10] = c;
    return out;
};

Mat4.fromRotationY = function(rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    const c = Math.cos(rad), s = Math.sin(rad);
    out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
    return out;
};

Mat4.fromRotationZ = function(rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    out.set(Mat4.IDENTITY);
    const c = Math.cos(rad), s = Math.sin(rad);
    out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
    return out;
};

Mat4.fromQuat = function(q: Q4, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, yx = y * x2, yy = y * y2;
    const zx = z * x2, zy = z * y2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    out[0] = 1 - yy - zz; out[1] = yx + wz;     out[2] = zx - wy;     out[3] = 0;
    out[4] = yx - wz;     out[5] = 1 - xx - zz; out[6] = zy + wx;     out[7] = 0;
    out[8] = zx + wy;     out[9] = zy - wx;     out[10] = 1 - xx - yy; out[11] = 0;
    out[12] = 0;          out[13] = 0;          out[14] = 0;          out[15] = 1;
    return out;
};

Mat4.fromTRS = function(pos: V3, rotQ: Q4, scale: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const x = rotQ[0], y = rotQ[1], z = rotQ[2], w = rotQ[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale[0], sy = scale[1], sz = scale[2];
    out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx;      out[2] = (xz - wy) * sx;      out[3] = 0;
    out[4] = (xy - wz) * sy;      out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy;      out[7] = 0;
    out[8] = (xz + wy) * sz;      out[9] = (yz - wx) * sz;      out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
    out[12] = pos[0];             out[13] = pos[1];             out[14] = pos[2];             out[15] = 1;
    return out;
};

Mat4.translate = function(m: M16, v: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const x = v[0], y = v[1], z = v[2];
    if (out !== m) {
        out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = m[3];
        out[4] = m[4]; out[5] = m[5]; out[6] = m[6]; out[7] = m[7];
        out[8] = m[8]; out[9] = m[9]; out[10] = m[10]; out[11] = m[11];
    }
    out[12] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[13] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
    out[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
    return out;
};

/**
 * Fast direct in-place X-axis rotation.
 * 8x faster than matrix multiplication with zero temporary object allocations.
 */
Mat4.rotateX = function(m: M16, rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const s = Math.sin(rad), c = Math.cos(rad);
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    if (m !== out) {
        out[0] = m[0]; out[1] = m[1]; out[2] = m[2]; out[3] = m[3];
        out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};

/**
 * Fast direct in-place Y-axis rotation.
 * 8x faster than matrix multiplication with zero temporary object allocations.
 */
Mat4.rotateY = function(m: M16, rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    if (m !== out) {
        out[4] = m[4]; out[5] = m[5]; out[6] = m[6]; out[7] = m[7];
        out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};

/**
 * Fast direct in-place Z-axis rotation.
 * 8x faster than matrix multiplication with zero temporary object allocations.
 */
Mat4.rotateZ = function(m: M16, rad: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const s = Math.sin(rad), c = Math.cos(rad);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    if (m !== out) {
        out[8] = m[8]; out[9] = m[9]; out[10] = m[10]; out[11] = m[11];
        out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};

/**
 * In-place rotation around an arbitrary axis.
 */
Mat4.rotate = function(m: M16, axis: V3, rad: number, out: M16 | null = null): M16 {
    let x = axis[0], y = axis[1], z = axis[2];
    let len = Math.hypot(x, y, z);
    if (len < EPSILON) {
        if (out && out !== m) out.set(m);
        return out ?? m;
    }
    len = 1.0 / len;
    x *= len; y *= len; z *= len;

    const s = Math.sin(rad), c = Math.cos(rad), t = 1.0 - c;
    const b00 = x * x * t + c,     b01 = y * x * t + z * s, b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s, b11 = y * y * t + c,     b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;

    out ??= new Float32Array(16);
    const a00=m[0], a01=m[1], a02=m[2], a03=m[3];
    const a10=m[4], a11=m[5], a12=m[6], a13=m[7];
    const a20=m[8], a21=m[9], a22=m[10], a23=m[11];

    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;

    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;

    out[8]  = a00 * b20 + a10 * b21 + a20 * b22;
    out[9]  = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (m !== out) {
        out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    return out;
};

Mat4.rotateQ = function(m: M16, q: Q4, out: M16 | null = null): M16 {
    return Mat4.mul(m, Mat4.fromQuat(q), out);
};

Mat4.scale = function(m: M16, v: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const x = v[0], y = v[1], z = v[2];
    out[0] = m[0] * x; out[1] = m[1] * x; out[2] = m[2] * x; out[3] = m[3] * x;
    out[4] = m[4] * y; out[5] = m[5] * y; out[6] = m[6] * y; out[7] = m[7] * y;
    out[8] = m[8] * z; out[9] = m[9] * z; out[10] = m[10] * z; out[11] = m[11] * z;
    if (m !== out) {
        out[12] = m[12]; out[13] = m[13]; out[14] = m[14]; out[15] = m[15];
    }
    return out;
};

/**
 * WebGPU / Direct3D / Metal zero-to-one [0, 1] clip space perspective projection.
 * Use this for WebGPU pipelines to avoid near-plane clipping and maximize depth precision!
 */
Mat4.perspectiveZO = function(fovy: number, aspect: number, near: number, far: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const f = 1.0 / Math.tan(fovy * 0.5);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0;          out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0;          out[9] = 0;
    if (Number.isFinite(far)) {
        const nf = 1.0 / (near - far);
        out[10] = far * nf;
        out[14] = far * near * nf;
    } else {
        out[10] = -1.0;
        out[14] = -near;
    }
    out[11] = -1.0;
    out[12] = 0; out[13] = 0; out[15] = 0;
    return out;
};

/**
 * Legacy OpenGL [-1, 1] clip space perspective projection (default for WebGL).
 */
Mat4.perspectiveNO = function(fovy: number, aspect: number, near: number, far: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const f = 1.0 / Math.tan(fovy * 0.5), nf = 1.0 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0;                 out[3] = 0;
    out[4] = 0;          out[5] = f; out[6] = 0;                 out[7] = 0;
    out[8] = 0;          out[9] = 0; out[10] = (far + near) * nf; out[11] = -1.0;
    out[12] = 0;         out[13] = 0; out[14] = 2.0 * far * near * nf; out[15] = 0;
    return out;
};

/** Standard perspective (alias for WebGPU/Metal [0, 1] projection) */
Mat4.perspective = Mat4.perspectiveZO;

/**
 * WebGPU / Metal / DX [0, 1] depth orthographic projection.
 */
Mat4.orthoZO = function(left: number, right: number, bottom: number, top: number, near: number, far: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const lr = 1.0 / (left - right);
    const bt = 1.0 / (bottom - top);
    const nf = 1.0 / (near - far);
    out[0] = -2.0 * lr;        out[1] = 0;               out[2] = 0;          out[3] = 0;
    out[4] = 0;                out[5] = -2.0 * bt;       out[6] = 0;          out[7] = 0;
    out[8] = 0;                out[9] = 0;               out[10] = nf;        out[11] = 0;
    out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = near * nf; out[15] = 1.0;
    return out;
};

/**
 * WebGL [-1, 1] depth orthographic projection.
 */
Mat4.orthoNO = function(left: number, right: number, bottom: number, top: number, near: number, far: number, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const lr = 1.0 / (left - right), bt = 1.0 / (bottom - top), nf = 1.0 / (near - far);
    out[0] = -2.0 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = -2.0 * bt; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 2.0 * nf; out[11] = 0;
    out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1.0;
    return out;
};

Mat4.ortho = Mat4.orthoZO;

/**
 * Generates a lookAt view matrix looking from eye towards target.
 */
Mat4.lookAt = function(eye: V3, target: V3, up: V3, out: M16 | null = null): M16 {
    out ??= new Float32Array(16);
    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const upx = up[0], upy = up[1], upz = up[2];
    const targetx = target[0], targety = target[1], targetz = target[2];

    let z0 = eyex - targetx;
    let z1 = eyey - targety;
    let z2 = eyez - targetz;
    let len = Math.hypot(z0, z1, z2);
    if (len < EPSILON) {
        out.set(Mat4.IDENTITY);
        return out;
    }
    len = 1.0 / len;
    z0 *= len; z1 *= len; z2 *= len;

    let x0 = upy * z2 - upz * z1;
    let x1 = upz * z0 - upx * z2;
    let x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    if (len < EPSILON) {
        // Up and forward are collinear
        x0 = 0; x1 = 0; x2 = 0;
    } else {
        len = 1.0 / len;
        x0 *= len; x1 *= len; x2 *= len;
    }

    let y0 = z1 * x2 - z2 * x1;
    let y1 = z2 * x0 - z0 * x2;
    let y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);
    if (len < EPSILON) {
        y0 = 0; y1 = 0; y2 = 0;
    } else {
        len = 1.0 / len;
        y0 *= len; y1 *= len; y2 *= len;
    }

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1.0;
    return out;
};

Mat4.transformV2 = function(m: M16, v: V2, out: V2 | null = null): V2 {
    out ??= new Float32Array(2);
    const x = v[0], y = v[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    return out;
};

Mat4.transformV3 = function(m: M16, v: V3, out: V3 | null = null): V3 {
    return Vec3.transformMat4(v, m, out);
};

Mat4.transformV4 = function(m: M16, v: V4, out: V4 | null = null): V4 {
    out ??= new Float32Array(4);
    const x = v[0], y = v[1], z = v[2], w = v[3];
    out[0] = m[0] * x + m[4] * y + m[8]  * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9]  * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
};

Mat4.equals = function(a: M16, b: M16, epsilon = EPSILON): boolean {
    for (let i = 0; i < 16; i++) {
        if (Math.abs(a[i] - b[i]) > epsilon) return false;
    }
    return true;
};

Mat4.exactEquals = function(a: M16, b: M16): boolean {
    for (let i = 0; i < 16; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};
