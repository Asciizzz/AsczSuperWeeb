import { EPSILON } from "./constants.js";

export class _Vec3 extends Float32Array {
    static get [Symbol.species](): Float32ArrayConstructor {
        return Float32Array;
    }

    static readonly UP: Readonly<_Vec3> = new _Vec3(0, 1, 0);
    static readonly DOWN: Readonly<_Vec3> = new _Vec3(0, -1, 0);
    static readonly RIGHT: Readonly<_Vec3> = new _Vec3(1, 0, 0);
    static readonly LEFT: Readonly<_Vec3> = new _Vec3(-1, 0, 0);
    static readonly FORWARD: Readonly<_Vec3> = new _Vec3(0, 0, -1);
    static readonly BACK: Readonly<_Vec3> = new _Vec3(0, 0, 1);
    static readonly ZERO: Readonly<_Vec3> = new _Vec3(0, 0, 0);
    static readonly ONE: Readonly<_Vec3> = new _Vec3(1, 1, 1);

    constructor();
    constructor(x: number, y: number, z: number);
    constructor(elements: ArrayLike<number>);
    constructor(buffer: ArrayBufferLike, byteOffset?: number);
    constructor(a?: number | ArrayLike<number> | ArrayBufferLike, b?: number, c?: number) {
        if (a instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && a instanceof SharedArrayBuffer)) {
            super(a as ArrayBuffer, b ?? 0, 3);
        } else {
            super(3);
            if (typeof a === "number") {
                this[0] = a;
                if (typeof b === "number") this[1] = b;
                if (typeof c === "number") this[2] = c;
            } else if (a && "length" in a) {
                this[0] = a[0] ?? 0;
                this[1] = a[1] ?? 0;
                this[2] = a[2] ?? 0;
            }
        }
    }

    get x(): number {
        return this[0];
    }
    set x(val: number) {
        this[0] = val;
    }

    get y(): number {
        return this[1];
    }
    set y(val: number) {
        this[1] = val;
    }

    get z(): number {
        return this[2];
    }
    set z(val: number) {
        this[2] = val;
    }

    get r(): number {
        return this[0];
    }
    set r(val: number) {
        this[0] = val;
    }

    get g(): number {
        return this[1];
    }
    set g(val: number) {
        this[1] = val;
    }

    get b(): number {
        return this[2];
    }
    set b(val: number) {
        this[2] = val;
    }

    static create(x = 0, y = 0, z = 0): _Vec3 {
        return new _Vec3(x, y, z);
    }

    static view(buffer: ArrayBufferLike, byteOffset = 0): _Vec3 {
        return new _Vec3(buffer, byteOffset);
    }

    static fromValues(x: number, y: number, z: number): _Vec3 {
        return new _Vec3(x, y, z);
    }

    static fromArray(array: ArrayLike<number>, offset = 0, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = array[offset];
        out[1] = array[offset + 1];
        out[2] = array[offset + 2];
        return out;
    }

    setValues(x: number, y: number, z: number): this {
        this[0] = x;
        this[1] = y;
        this[2] = z;
        return this;
    }

    copy(src: ArrayLike<number>): this {
        this[0] = src[0];
        this[1] = src[1];
        this[2] = src[2];
        return this;
    }

    clone(): _Vec3 {
        return new _Vec3(this[0], this[1], this[2]);
    }

    add(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] + b[0];
        out[1] = this[1] + b[1];
        out[2] = this[2] + b[2];
        return out;
    }

    sub(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] - b[0];
        out[1] = this[1] - b[1];
        out[2] = this[2] - b[2];
        return out;
    }

    mul(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] * b[0];
        out[1] = this[1] * b[1];
        out[2] = this[2] * b[2];
        return out;
    }

    div(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] / b[0];
        out[1] = this[1] / b[1];
        out[2] = this[2] / b[2];
        return out;
    }

    scale(s: number, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] * s;
        out[1] = this[1] * s;
        out[2] = this[2] * s;
        return out;
    }

    scaleAndAdd(b: ArrayLike<number>, s: number, out: _Vec3 = this): _Vec3 {
        out[0] = this[0] + b[0] * s;
        out[1] = this[1] + b[1] * s;
        out[2] = this[2] + b[2] * s;
        return out;
    }

    negate(out: _Vec3 = this): _Vec3 {
        out[0] = -this[0];
        out[1] = -this[1];
        out[2] = -this[2];
        return out;
    }

    dot(b: ArrayLike<number>): number {
        return this[0] * b[0] + this[1] * b[1] + this[2] * b[2];
    }

    cross(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const ax = this[0], ay = this[1], az = this[2];
        const bx = b[0], by = b[1], bz = b[2];
        out[0] = ay * bz - az * by;
        out[1] = az * bx - ax * bz;
        out[2] = ax * by - ay * bx;
        return out;
    }

    len(): number {
        const x = this[0], y = this[1], z = this[2];
        return Math.sqrt(x * x + y * y + z * z);
    }

    lenSq(): number {
        const x = this[0], y = this[1], z = this[2];
        return x * x + y * y + z * z;
    }

    magnitude(): number {
        return this.len();
    }

    magnitudeSq(): number {
        return this.lenSq();
    }

    normalize(out: _Vec3 = this): _Vec3 {
        const x = this[0], y = this[1], z = this[2];
        const lenSq = x * x + y * y + z * z;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
            out[2] = z * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
        }
        return out;
    }

    norm(out: _Vec3 = this): _Vec3 {
        return this.normalize(out);
    }

    distance(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        const dz = b[2] - this[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    distanceSq(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        const dz = b[2] - this[2];
        return dx * dx + dy * dy + dz * dz;
    }

    lerp(b: ArrayLike<number>, t: number, out: _Vec3 = this): _Vec3 {
        const x = this[0], y = this[1], z = this[2];
        out[0] = x + (b[0] - x) * t;
        out[1] = y + (b[1] - y) * t;
        out[2] = z + (b[2] - z) * t;
        return out;
    }

    min(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = Math.min(this[0], b[0]);
        out[1] = Math.min(this[1], b[1]);
        return out;
    }

    max(b: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = Math.max(this[0], b[0]);
        out[1] = Math.max(this[1], b[1]);
        return out;
    }

    clamp(min: ArrayLike<number>, max: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        out[0] = Math.max(min[0], Math.min(max[0], this[0]));
        out[1] = Math.max(min[1], Math.min(max[1], this[1]));
        out[2] = Math.max(min[2], Math.min(max[2], this[2]));
        return out;
    }

    reflect(normal: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const d = 2 * (this[0] * normal[0] + this[1] * normal[1] + this[2] * normal[2]);
        out[0] = this[0] - d * normal[0];
        out[1] = this[1] - d * normal[1];
        out[2] = this[2] - d * normal[2];
        return out;
    }

    angle(b: ArrayLike<number>): number {
        const lsq1 = this[0] * this[0] + this[1] * this[1] + this[2] * this[2];
        const lsq2 = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
        if (lsq1 === 0 || lsq2 === 0) return 0;
        const dot = this[0] * b[0] + this[1] * b[1] + this[2] * b[2];
        const cos = dot / Math.sqrt(lsq1 * lsq2);
        return Math.acos(Math.max(-1, Math.min(1, cos)));
    }

    transformMat4(m: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const x = this[0], y = this[1], z = this[2];
        let w = m[3] * x + m[7] * y + m[11] * z + m[15];
        w = w !== 0 ? 1.0 / w : 1.0;
        out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
        out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
        out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
        return out;
    }

    transformMat4Direction(m: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const x = this[0], y = this[1], z = this[2];
        out[0] = m[0] * x + m[4] * y + m[8] * z;
        out[1] = m[1] * x + m[5] * y + m[9] * z;
        out[2] = m[2] * x + m[6] * y + m[10] * z;
        return out;
    }

    transformMat3(m: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const x = this[0], y = this[1], z = this[2];
        out[0] = m[0] * x + m[3] * y + m[6] * z;
        out[1] = m[1] * x + m[4] * y + m[7] * z;
        out[2] = m[2] * x + m[5] * y + m[8] * z;
        return out;
    }

    transformQuat(q: ArrayLike<number>, out: _Vec3 = this): _Vec3 {
        const vx = this[0], vy = this[1], vz = this[2];
        const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);
        out[0] = vx + qw * tx + qy * tz - qz * ty;
        out[1] = vy + qw * ty + qz * tx - qx * tz;
        out[2] = vz + qw * tz + qx * ty - qy * tx;
        return out;
    }

    equals(b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return (
            Math.abs(this[0] - b[0]) <= epsilon &&
            Math.abs(this[1] - b[1]) <= epsilon &&
            Math.abs(this[2] - b[2]) <= epsilon
        );
    }

    exactEquals(b: ArrayLike<number>): boolean {
        return this[0] === b[0] && this[1] === b[1] && this[2] === b[2];
    }

    // Static procedural API
    static set(x: number, y: number, z: number, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = x;
        out[1] = y;
        out[2] = z;
        return out;
    }

    static copy(a: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0];
        out[1] = a[1];
        out[2] = a[2];
        return out;
    }

    static clone(a: ArrayLike<number>): _Vec3 {
        return new _Vec3(a[0], a[1], a[2]);
    }

    static add(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        return out;
    }

    static sub(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        return out;
    }

    static mul(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];
        out[2] = a[2] * b[2];
        return out;
    }

    static div(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];
        out[2] = a[2] / b[2];
        return out;
    }

    static scale(a: ArrayLike<number>, s: number, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] * s;
        out[1] = a[1] * s;
        out[2] = a[2] * s;
        return out;
    }

    static scaleAndAdd(a: ArrayLike<number>, b: ArrayLike<number>, s: number, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] + b[0] * s;
        out[1] = a[1] + b[1] * s;
        out[2] = a[2] + b[2] * s;
        return out;
    }

    static negate(a: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = -a[0];
        out[1] = -a[1];
        out[2] = -a[2];
        return out;
    }

    static dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    static cross(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const ax = a[0], ay = a[1], az = a[2];
        const bx = b[0], by = b[1], bz = b[2];
        out[0] = ay * bz - az * by;
        out[1] = az * bx - ax * bz;
        out[2] = ax * by - ay * bx;
        return out;
    }

    static length(a: ArrayLike<number>): number {
        const x = a[0], y = a[1], z = a[2];
        return Math.sqrt(x * x + y * y + z * z);
    }

    static len(a: ArrayLike<number>): number {
        return _Vec3.length(a);
    }

    static lengthSq(a: ArrayLike<number>): number {
        const x = a[0], y = a[1], z = a[2];
        return x * x + y * y + z * z;
    }

    static lenSq(a: ArrayLike<number>): number {
        return _Vec3.lengthSq(a);
    }

    static normalize(a: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const x = a[0], y = a[1], z = a[2];
        const lenSq = x * x + y * y + z * z;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
            out[2] = z * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
        }
        return out;
    }

    static norm(a: ArrayLike<number>, out?: _Vec3): _Vec3 {
        return _Vec3.normalize(a, out);
    }

    static distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    static distanceSq(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        return dx * dx + dy * dy + dz * dz;
    }

    static lerp(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = a[0] + (b[0] - a[0]) * t;
        out[1] = a[1] + (b[1] - a[1]) * t;
        out[2] = a[2] + (b[2] - a[2]) * t;
        return out;
    }

    static min(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = Math.min(a[0], b[0]);
        out[1] = Math.min(a[1], b[1]);
        out[2] = Math.min(a[2], b[2]);
        return out;
    }

    static max(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = Math.max(a[0], b[0]);
        out[1] = Math.max(a[1], b[1]);
        out[2] = Math.max(a[2], b[2]);
        return out;
    }

    static clamp(a: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        out[0] = Math.max(min[0], Math.min(max[0], a[0]));
        out[1] = Math.max(min[1], Math.min(max[1], a[1]));
        out[2] = Math.max(min[2], Math.min(max[2], a[2]));
        return out;
    }

    static reflect(v: ArrayLike<number>, normal: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const d = 2 * (v[0] * normal[0] + v[1] * normal[1] + v[2] * normal[2]);
        out[0] = v[0] - d * normal[0];
        out[1] = v[1] - d * normal[1];
        out[2] = v[2] - d * normal[2];
        return out;
    }

    static angle(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const lsq1 = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
        const lsq2 = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
        if (lsq1 === 0 || lsq2 === 0) return 0;
        const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        const cos = dot / Math.sqrt(lsq1 * lsq2);
        return Math.acos(Math.max(-1, Math.min(1, cos)));
    }

    static transformMat4(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const x = v[0], y = v[1], z = v[2];
        let w = m[3] * x + m[7] * y + m[11] * z + m[15];
        w = w !== 0 ? 1.0 / w : 1.0;
        out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
        out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
        out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
        return out;
    }

    static transformMat4Direction(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const x = v[0], y = v[1], z = v[2];
        out[0] = m[0] * x + m[4] * y + m[8] * z;
        out[1] = m[1] * x + m[5] * y + m[9] * z;
        out[2] = m[2] * x + m[6] * y + m[10] * z;
        return out;
    }

    static transformMat3(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const x = v[0], y = v[1], z = v[2];
        out[0] = m[0] * x + m[3] * y + m[6] * z;
        out[1] = m[1] * x + m[4] * y + m[7] * z;
        out[2] = m[2] * x + m[5] * y + m[8] * z;
        return out;
    }

    static transformQuat(v: ArrayLike<number>, q: ArrayLike<number>, out?: _Vec3): _Vec3 {
        out ??= new _Vec3();
        const vx = v[0], vy = v[1], vz = v[2];
        const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);
        out[0] = vx + qw * tx + qy * tz - qz * ty;
        out[1] = vy + qw * ty + qz * tx - qx * tz;
        out[2] = vz + qw * tz + qx * ty - qy * tx;
        return out;
    }

    static equals(a: ArrayLike<number>, b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return (
            Math.abs(a[0] - b[0]) <= epsilon &&
            Math.abs(a[1] - b[1]) <= epsilon &&
            Math.abs(a[2] - b[2]) <= epsilon
        );
    }

    static exactEquals(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    }

    /**
     * Bulk transform an array of 3D positions by a 4x4 matrix with perspective division.
     */
    static transformPositions(
        m: ArrayLike<number>,
        src: Float32Array,
        dst: Float32Array,
        count: number,
        srcStride = 3,
        dstStride = 3
    ): void {
        const m0 = m[0], m1 = m[1], m2 = m[2];
        const m4 = m[4], m5 = m[5], m6 = m[6];
        const m8 = m[8], m9 = m[9], m10 = m[10];
        const m12 = m[12], m13 = m[13], m14 = m[14];
        const m3 = m[3], m7 = m[7], m11 = m[11], m15 = m[15];

        let sIdx = 0;
        let dIdx = 0;
        for (let i = 0; i < count; i++) {
            const x = src[sIdx];
            const y = src[sIdx + 1];
            const z = src[sIdx + 2];

            let w = m3 * x + m7 * y + m11 * z + m15;
            w = w !== 0 ? 1.0 / w : 1.0;

            dst[dIdx] = (m0 * x + m4 * y + m8 * z + m12) * w;
            dst[dIdx + 1] = (m1 * x + m5 * y + m9 * z + m13) * w;
            dst[dIdx + 2] = (m2 * x + m6 * y + m10 * z + m14) * w;

            sIdx += srcStride;
            dIdx += dstStride;
        }
    }

    /**
     * Bulk transform an array of 3D directional vectors by a 4x4 matrix (ignoring translation).
     */
    static transformDirections(
        m: ArrayLike<number>,
        src: Float32Array,
        dst: Float32Array,
        count: number,
        srcStride = 3,
        dstStride = 3
    ): void {
        const m0 = m[0], m1 = m[1], m2 = m[2];
        const m4 = m[4], m5 = m[5], m6 = m[6];
        const m8 = m[8], m9 = m[9], m10 = m[10];

        let sIdx = 0;
        let dIdx = 0;
        for (let i = 0; i < count; i++) {
            const x = src[sIdx];
            const y = src[sIdx + 1];
            const z = src[sIdx + 2];

            dst[dIdx] = m0 * x + m4 * y + m8 * z;
            dst[dIdx + 1] = m1 * x + m5 * y + m9 * z;
            dst[dIdx + 2] = m2 * x + m6 * y + m10 * z;

            sIdx += srcStride;
            dIdx += dstStride;
        }
    }
}

export type Vec3 = _Vec3;

export interface Vec3Factory {
    new (): Vec3;
    new (x: number, y: number, z: number): Vec3;
    new (elements: ArrayLike<number>): Vec3;
    new (buffer: ArrayBufferLike, byteOffset?: number): Vec3;

    (): Vec3;
    (x?: number, y?: number, z?: number): Vec3;
    (elements: ArrayLike<number>): Vec3;
    (buffer: ArrayBufferLike, byteOffset?: number): Vec3;
}

export type Vec3Constructor = typeof _Vec3 & Vec3Factory;

const _Vec3Wrapper: any = function (
    a?: number | ArrayLike<number> | ArrayBufferLike,
    b?: number,
    c?: number
): Vec3 {
    return new (_Vec3 as any)(a, b, c);
};
Object.setPrototypeOf(_Vec3Wrapper, _Vec3);
_Vec3Wrapper.prototype = _Vec3.prototype;

export const Vec3: Vec3Constructor = _Vec3Wrapper;
