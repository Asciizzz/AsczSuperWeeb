import { EPSILON } from "./constants.js";

export class _Vec4 extends Float32Array {
    static get [Symbol.species](): Float32ArrayConstructor {
        return Float32Array;
    }

    static readonly ZERO: Readonly<_Vec4> = new _Vec4(0, 0, 0, 0);
    static readonly ONE: Readonly<_Vec4> = new _Vec4(1, 1, 1, 1);

    constructor();
    constructor(x: number, y: number, z: number, w: number);
    constructor(elements: ArrayLike<number>);
    constructor(buffer: ArrayBufferLike, byteOffset?: number);
    constructor(a?: number | ArrayLike<number> | ArrayBufferLike, b?: number, c?: number, d?: number) {
        if (a instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && a instanceof SharedArrayBuffer)) {
            super(a as ArrayBuffer, b ?? 0, 4);
        } else {
            super(4);
            if (typeof a === "number") {
                this[0] = a;
                if (typeof b === "number") this[1] = b;
                if (typeof c === "number") this[2] = c;
                if (typeof d === "number") this[3] = d;
            } else if (a && "length" in a) {
                this[0] = a[0] ?? 0;
                this[1] = a[1] ?? 0;
                this[2] = a[2] ?? 0;
                this[3] = a[3] ?? 0;
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

    get w(): number {
        return this[3];
    }
    set w(val: number) {
        this[3] = val;
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

    get a(): number {
        return this[3];
    }
    set a(val: number) {
        this[3] = val;
    }

    static create(x = 0, y = 0, z = 0, w = 0): _Vec4 {
        return new _Vec4(x, y, z, w);
    }

    static view(buffer: ArrayBufferLike, byteOffset = 0): _Vec4 {
        return new _Vec4(buffer, byteOffset);
    }

    static fromValues(x: number, y: number, z: number, w: number): _Vec4 {
        return new _Vec4(x, y, z, w);
    }

    static fromArray(array: ArrayLike<number>, offset = 0, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = array[offset];
        out[1] = array[offset + 1];
        out[2] = array[offset + 2];
        out[3] = array[offset + 3];
        return out;
    }

    setValues(x: number, y: number, z: number, w: number): this {
        this[0] = x;
        this[1] = y;
        this[2] = z;
        this[3] = w;
        return this;
    }

    copy(src: ArrayLike<number>): this {
        this[0] = src[0];
        this[1] = src[1];
        this[2] = src[2];
        this[3] = src[3];
        return this;
    }

    clone(): _Vec4 {
        return new _Vec4(this[0], this[1], this[2], this[3]);
    }

    add(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] + b[0];
        out[1] = this[1] + b[1];
        out[2] = this[2] + b[2];
        out[3] = this[3] + b[3];
        return out;
    }

    sub(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] - b[0];
        out[1] = this[1] - b[1];
        out[2] = this[2] - b[2];
        out[3] = this[3] - b[3];
        return out;
    }

    mul(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] * b[0];
        out[1] = this[1] * b[1];
        out[2] = this[2] * b[2];
        out[3] = this[3] * b[3];
        return out;
    }

    div(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] / b[0];
        out[1] = this[1] / b[1];
        out[2] = this[2] / b[2];
        out[3] = this[3] / b[3];
        return out;
    }

    scale(s: number, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] * s;
        out[1] = this[1] * s;
        out[2] = this[2] * s;
        out[3] = this[3] * s;
        return out;
    }

    scaleAndAdd(b: ArrayLike<number>, s: number, out: _Vec4 = this): _Vec4 {
        out[0] = this[0] + b[0] * s;
        out[1] = this[1] + b[1] * s;
        out[2] = this[2] + b[2] * s;
        out[3] = this[3] + b[3] * s;
        return out;
    }

    negate(out: _Vec4 = this): _Vec4 {
        out[0] = -this[0];
        out[1] = -this[1];
        out[2] = -this[2];
        out[3] = -this[3];
        return out;
    }

    dot(b: ArrayLike<number>): number {
        return this[0] * b[0] + this[1] * b[1] + this[2] * b[2] + this[3] * b[3];
    }

    len(): number {
        const x = this[0], y = this[1], z = this[2], w = this[3];
        return Math.sqrt(x * x + y * y + z * z + w * w);
    }

    lenSq(): number {
        const x = this[0], y = this[1], z = this[2], w = this[3];
        return x * x + y * y + z * z + w * w;
    }

    magnitude(): number {
        return this.len();
    }

    magnitudeSq(): number {
        return this.lenSq();
    }

    normalize(out: _Vec4 = this): _Vec4 {
        const x = this[0], y = this[1], z = this[2], w = this[3];
        const lenSq = x * x + y * y + z * z + w * w;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
            out[2] = z * invLen;
            out[3] = w * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
        }
        return out;
    }

    norm(out: _Vec4 = this): _Vec4 {
        return this.normalize(out);
    }

    distance(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        const dz = b[2] - this[2];
        const dw = b[3] - this[3];
        return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw);
    }

    distanceSq(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        const dz = b[2] - this[2];
        const dw = b[3] - this[3];
        return dx * dx + dy * dy + dz * dz + dw * dw;
    }

    lerp(b: ArrayLike<number>, t: number, out: _Vec4 = this): _Vec4 {
        const x = this[0], y = this[1], z = this[2], w = this[3];
        out[0] = x + (b[0] - x) * t;
        out[1] = y + (b[1] - y) * t;
        out[2] = z + (b[2] - z) * t;
        out[3] = w + (b[3] - w) * t;
        return out;
    }

    min(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = Math.min(this[0], b[0]);
        out[1] = Math.min(this[1], b[1]);
        out[2] = Math.min(this[2], b[2]);
        out[3] = Math.min(this[3], b[3]);
        return out;
    }

    max(b: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = Math.max(this[0], b[0]);
        out[1] = Math.max(this[1], b[1]);
        out[2] = Math.max(this[2], b[2]);
        out[3] = Math.max(this[3], b[3]);
        return out;
    }

    clamp(min: ArrayLike<number>, max: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        out[0] = Math.max(min[0], Math.min(max[0], this[0]));
        out[1] = Math.max(min[1], Math.min(max[1], this[1]));
        out[2] = Math.max(min[2], Math.min(max[2], this[2]));
        out[3] = Math.max(min[3], Math.min(max[3], this[3]));
        return out;
    }

    transformMat4(m: ArrayLike<number>, out: _Vec4 = this): _Vec4 {
        const x = this[0], y = this[1], z = this[2], w = this[3];
        out[0] = m[0] * x + m[4] * y + m[8]  * z + m[12] * w;
        out[1] = m[1] * x + m[5] * y + m[9]  * z + m[13] * w;
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
        out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
        return out;
    }

    equals(b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return (
            Math.abs(this[0] - b[0]) <= epsilon &&
            Math.abs(this[1] - b[1]) <= epsilon &&
            Math.abs(this[2] - b[2]) <= epsilon &&
            Math.abs(this[3] - b[3]) <= epsilon
        );
    }

    exactEquals(b: ArrayLike<number>): boolean {
        return (
            this[0] === b[0] &&
            this[1] === b[1] &&
            this[2] === b[2] &&
            this[3] === b[3]
        );
    }

    // Static procedural API
    static set(x: number, y: number, z: number, w: number, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = x;
        out[1] = y;
        out[2] = z;
        out[3] = w;
        return out;
    }

    static copy(a: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0];
        out[1] = a[1];
        out[2] = a[2];
        out[3] = a[3];
        return out;
    }

    static clone(a: ArrayLike<number>): _Vec4 {
        return new _Vec4(a[0], a[1], a[2], a[3]);
    }

    static add(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        out[3] = a[3] + b[3];
        return out;
    }

    static sub(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        out[3] = a[3] - b[3];
        return out;
    }

    static mul(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];
        out[2] = a[2] * b[2];
        out[3] = a[3] * b[3];
        return out;
    }

    static div(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];
        out[2] = a[2] / b[2];
        out[3] = a[3] / b[3];
        return out;
    }

    static scale(a: ArrayLike<number>, s: number, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] * s;
        out[1] = a[1] * s;
        out[2] = a[2] * s;
        out[3] = a[3] * s;
        return out;
    }

    static scaleAndAdd(a: ArrayLike<number>, b: ArrayLike<number>, s: number, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] + b[0] * s;
        out[1] = a[1] + b[1] * s;
        out[2] = a[2] + b[2] * s;
        out[3] = a[3] + b[3] * s;
        return out;
    }

    static negate(a: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = -a[0];
        out[1] = -a[1];
        out[2] = -a[2];
        out[3] = -a[3];
        return out;
    }

    static dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    }

    static length(a: ArrayLike<number>): number {
        const x = a[0], y = a[1], z = a[2], w = a[3];
        return Math.sqrt(x * x + y * y + z * z + w * w);
    }

    static len(a: ArrayLike<number>): number {
        return _Vec4.length(a);
    }

    static lengthSq(a: ArrayLike<number>): number {
        const x = a[0], y = a[1], z = a[2], w = a[3];
        return x * x + y * y + z * z + w * w;
    }

    static lenSq(a: ArrayLike<number>): number {
        return _Vec4.lengthSq(a);
    }

    static normalize(a: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        const x = a[0], y = a[1], z = a[2], w = a[3];
        const lenSq = x * x + y * y + z * z + w * w;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
            out[2] = z * invLen;
            out[3] = w * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 0;
        }
        return out;
    }

    static norm(a: ArrayLike<number>, out?: _Vec4): _Vec4 {
        return _Vec4.normalize(a, out);
    }

    static distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const dw = b[3] - a[3];
        return Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw);
    }

    static distanceSq(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const dw = b[3] - a[3];
        return dx * dx + dy * dy + dz * dz + dw * dw;
    }

    static lerp(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = a[0] + (b[0] - a[0]) * t;
        out[1] = a[1] + (b[1] - a[1]) * t;
        out[2] = a[2] + (b[2] - a[2]) * t;
        out[3] = a[3] + (b[3] - a[3]) * t;
        return out;
    }

    static min(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = Math.min(a[0], b[0]);
        out[1] = Math.min(a[1], b[1]);
        out[2] = Math.min(a[2], b[2]);
        out[3] = Math.min(a[3], b[3]);
        return out;
    }

    static max(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = Math.max(a[0], b[0]);
        out[1] = Math.max(a[1], b[1]);
        out[2] = Math.max(a[2], b[2]);
        out[3] = Math.max(a[3], b[3]);
        return out;
    }

    static clamp(a: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        out[0] = Math.max(min[0], Math.min(max[0], a[0]));
        out[1] = Math.max(min[1], Math.min(max[1], a[1]));
        out[2] = Math.max(min[2], Math.min(max[2], a[2]));
        out[3] = Math.max(min[3], Math.min(max[3], a[3]));
        return out;
    }

    static transformMat4(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec4): _Vec4 {
        out ??= new _Vec4();
        const x = v[0], y = v[1], z = v[2], w = v[3];
        out[0] = m[0] * x + m[4] * y + m[8]  * z + m[12] * w;
        out[1] = m[1] * x + m[5] * y + m[9]  * z + m[13] * w;
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
        out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
        return out;
    }

    static equals(a: ArrayLike<number>, b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return (
            Math.abs(a[0] - b[0]) <= epsilon &&
            Math.abs(a[1] - b[1]) <= epsilon &&
            Math.abs(a[2] - b[2]) <= epsilon &&
            Math.abs(a[3] - b[3]) <= epsilon
        );
    }

    static exactEquals(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        return (
            a[0] === b[0] &&
            a[1] === b[1] &&
            a[2] === b[2] &&
            a[3] === b[3]
        );
    }
}

export type Vec4 = _Vec4;

export interface Vec4Factory {
    new (): Vec4;
    new (x: number, y: number, z: number, w: number): Vec4;
    new (elements: ArrayLike<number>): Vec4;
    new (buffer: ArrayBufferLike, byteOffset?: number): Vec4;

    (): Vec4;
    (x?: number, y?: number, z?: number, w?: number): Vec4;
    (elements: ArrayLike<number>): Vec4;
    (buffer: ArrayBufferLike, byteOffset?: number): Vec4;
}

export type Vec4Constructor = typeof _Vec4 & Vec4Factory;

const _Vec4Wrapper: any = function (
    a?: number | ArrayLike<number> | ArrayBufferLike,
    b?: number,
    c?: number,
    d?: number
): Vec4 {
    return new (_Vec4 as any)(a, b, c, d);
};
Object.setPrototypeOf(_Vec4Wrapper, _Vec4);
_Vec4Wrapper.prototype = _Vec4.prototype;

export const Vec4: Vec4Constructor = _Vec4Wrapper;
