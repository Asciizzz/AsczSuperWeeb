import { EPSILON } from "./constants.js";

export class _Vec2 extends Float32Array {
    static get [Symbol.species](): Float32ArrayConstructor {
        return Float32Array;
    }

    static readonly ZERO: Readonly<_Vec2> = new _Vec2(0, 0);
    static readonly ONE: Readonly<_Vec2> = new _Vec2(1, 1);
    static readonly UNIT_X: Readonly<_Vec2> = new _Vec2(1, 0);
    static readonly UNIT_Y: Readonly<_Vec2> = new _Vec2(0, 1);

    constructor();
    constructor(x: number, y: number);
    constructor(elements: ArrayLike<number>);
    constructor(buffer: ArrayBufferLike, byteOffset?: number);
    constructor(a?: number | ArrayLike<number> | ArrayBufferLike, b?: number) {
        if (a instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && a instanceof SharedArrayBuffer)) {
            super(a as ArrayBuffer, b ?? 0, 2);
        } else {
            super(2);
            if (typeof a === "number") {
                this[0] = a;
                if (typeof b === "number") this[1] = b;
            } else if (a && "length" in a) {
                this[0] = a[0] ?? 0;
                this[1] = a[1] ?? 0;
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

    get u(): number {
        return this[0];
    }
    set u(val: number) {
        this[0] = val;
    }

    get v(): number {
        return this[1];
    }
    set v(val: number) {
        this[1] = val;
    }

    get width(): number {
        return this[0];
    }
    set width(val: number) {
        this[0] = val;
    }

    get height(): number {
        return this[1];
    }
    set height(val: number) {
        this[1] = val;
    }

    static create(x = 0, y = 0): _Vec2 {
        return new _Vec2(x, y);
    }

    static view(buffer: ArrayBufferLike, byteOffset = 0): _Vec2 {
        return new _Vec2(buffer, byteOffset);
    }

    static fromValues(x: number, y: number): _Vec2 {
        return new _Vec2(x, y);
    }

    static fromArray(array: ArrayLike<number>, offset = 0, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = array[offset];
        out[1] = array[offset + 1];
        return out;
    }

    setValues(x: number, y: number): this {
        this[0] = x;
        this[1] = y;
        return this;
    }

    copy(src: ArrayLike<number>): this {
        this[0] = src[0];
        this[1] = src[1];
        return this;
    }

    clone(): _Vec2 {
        return new _Vec2(this[0], this[1]);
    }

    add(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] + b[0];
        out[1] = this[1] + b[1];
        return out;
    }

    sub(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] - b[0];
        out[1] = this[1] - b[1];
        return out;
    }

    mul(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] * b[0];
        out[1] = this[1] * b[1];
        return out;
    }

    div(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] / b[0];
        out[1] = this[1] / b[1];
        return out;
    }

    scale(s: number, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] * s;
        out[1] = this[1] * s;
        return out;
    }

    scaleAndAdd(b: ArrayLike<number>, s: number, out: _Vec2 = this): _Vec2 {
        out[0] = this[0] + b[0] * s;
        out[1] = this[1] + b[1] * s;
        return out;
    }

    negate(out: _Vec2 = this): _Vec2 {
        out[0] = -this[0];
        out[1] = -this[1];
        return out;
    }

    dot(b: ArrayLike<number>): number {
        return this[0] * b[0] + this[1] * b[1];
    }

    cross(b: ArrayLike<number>): number {
        return this[0] * b[1] - this[1] * b[0];
    }

    len(): number {
        const x = this[0], y = this[1];
        return Math.sqrt(x * x + y * y);
    }

    lenSq(): number {
        const x = this[0], y = this[1];
        return x * x + y * y;
    }

    magnitude(): number {
        return this.len();
    }

    magnitudeSq(): number {
        return this.lenSq();
    }

    normalize(out: _Vec2 = this): _Vec2 {
        const x = this[0], y = this[1];
        const lenSq = x * x + y * y;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
        }
        return out;
    }

    norm(out: _Vec2 = this): _Vec2 {
        return this.normalize(out);
    }

    distance(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceSq(b: ArrayLike<number>): number {
        const dx = b[0] - this[0];
        const dy = b[1] - this[1];
        return dx * dx + dy * dy;
    }

    lerp(b: ArrayLike<number>, t: number, out: _Vec2 = this): _Vec2 {
        const x = this[0], y = this[1];
        out[0] = x + (b[0] - x) * t;
        out[1] = y + (b[1] - y) * t;
        return out;
    }

    min(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = Math.min(this[0], b[0]);
        out[1] = Math.min(this[1], b[1]);
        return out;
    }

    max(b: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = Math.max(this[0], b[0]);
        out[1] = Math.max(this[1], b[1]);
        return out;
    }

    clamp(min: ArrayLike<number>, max: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        out[0] = Math.max(min[0], Math.min(max[0], this[0]));
        out[1] = Math.max(min[1], Math.min(max[1], this[1]));
        return out;
    }

    equals(b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return Math.abs(this[0] - b[0]) <= epsilon && Math.abs(this[1] - b[1]) <= epsilon;
    }

    exactEquals(b: ArrayLike<number>): boolean {
        return this[0] === b[0] && this[1] === b[1];
    }

    transformMat3(m: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        const x = this[0], y = this[1];
        out[0] = m[0] * x + m[3] * y + m[6];
        out[1] = m[1] * x + m[4] * y + m[7];
        return out;
    }

    transformMat4(m: ArrayLike<number>, out: _Vec2 = this): _Vec2 {
        const x = this[0], y = this[1];
        out[0] = m[0] * x + m[4] * y + m[12];
        out[1] = m[1] * x + m[5] * y + m[13];
        return out;
    }

    // Static procedural API
    static set(x: number, y: number, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = x;
        out[1] = y;
        return out;
    }

    static copy(a: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0];
        out[1] = a[1];
        return out;
    }

    static clone(a: ArrayLike<number>): _Vec2 {
        return new _Vec2(a[0], a[1]);
    }

    static add(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        return out;
    }

    static sub(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        return out;
    }

    static mul(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] * b[0];
        out[1] = a[1] * b[1];
        return out;
    }

    static div(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] / b[0];
        out[1] = a[1] / b[1];
        return out;
    }

    static scale(a: ArrayLike<number>, s: number, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] * s;
        out[1] = a[1] * s;
        return out;
    }

    static scaleAndAdd(a: ArrayLike<number>, b: ArrayLike<number>, s: number, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] + b[0] * s;
        out[1] = a[1] + b[1] * s;
        return out;
    }

    static negate(a: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = -a[0];
        out[1] = -a[1];
        return out;
    }

    static dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
        return a[0] * b[0] + a[1] * b[1];
    }

    static cross(a: ArrayLike<number>, b: ArrayLike<number>): number {
        return a[0] * b[1] - a[1] * b[0];
    }

    static length(a: ArrayLike<number>): number {
        const x = a[0], y = a[1];
        return Math.sqrt(x * x + y * y);
    }

    static len(a: ArrayLike<number>): number {
        return _Vec2.length(a);
    }

    static lengthSq(a: ArrayLike<number>): number {
        const x = a[0], y = a[1];
        return x * x + y * y;
    }

    static lenSq(a: ArrayLike<number>): number {
        return _Vec2.lengthSq(a);
    }

    static normalize(a: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        const x = a[0], y = a[1];
        const lenSq = x * x + y * y;
        if (lenSq > EPSILON * EPSILON) {
            const invLen = 1.0 / Math.sqrt(lenSq);
            out[0] = x * invLen;
            out[1] = y * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
        }
        return out;
    }

    static norm(a: ArrayLike<number>, out?: _Vec2): _Vec2 {
        return _Vec2.normalize(a, out);
    }

    static distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    static distanceSq(a: ArrayLike<number>, b: ArrayLike<number>): number {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        return dx * dx + dy * dy;
    }

    static lerp(a: ArrayLike<number>, b: ArrayLike<number>, t: number, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = a[0] + (b[0] - a[0]) * t;
        out[1] = a[1] + (b[1] - a[1]) * t;
        return out;
    }

    static min(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = Math.min(a[0], b[0]);
        out[1] = Math.min(a[1], b[1]);
        return out;
    }

    static max(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = Math.max(a[0], b[0]);
        out[1] = Math.max(a[1], b[1]);
        return out;
    }

    static clamp(a: ArrayLike<number>, min: ArrayLike<number>, max: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        out[0] = Math.max(min[0], Math.min(max[0], a[0]));
        out[1] = Math.max(min[1], Math.min(max[1], a[1]));
        return out;
    }

    static equals(a: ArrayLike<number>, b: ArrayLike<number>, epsilon = EPSILON): boolean {
        return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
    }

    static exactEquals(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        return a[0] === b[0] && a[1] === b[1];
    }

    static transformMat3(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        const x = v[0], y = v[1];
        out[0] = m[0] * x + m[3] * y + m[6];
        out[1] = m[1] * x + m[4] * y + m[7];
        return out;
    }

    static transformMat4(v: ArrayLike<number>, m: ArrayLike<number>, out?: _Vec2): _Vec2 {
        out ??= new _Vec2();
        const x = v[0], y = v[1];
        out[0] = m[0] * x + m[4] * y + m[12];
        out[1] = m[1] * x + m[5] * y + m[13];
        return out;
    }
}

export type Vec2 = _Vec2;

export interface Vec2Factory {
    new (): Vec2;
    new (x: number, y: number): Vec2;
    new (elements: ArrayLike<number>): Vec2;
    new (buffer: ArrayBufferLike, byteOffset?: number): Vec2;

    (): Vec2;
    (x?: number, y?: number): Vec2;
    (elements: ArrayLike<number>): Vec2;
    (buffer: ArrayBufferLike, byteOffset?: number): Vec2;
}

export type Vec2Constructor = typeof _Vec2 & Vec2Factory;

const _Vec2Wrapper: any = function (a?: number | ArrayLike<number> | ArrayBufferLike, b?: number): Vec2 {
    return new _Vec2(a as any, b);
};
Object.setPrototypeOf(_Vec2Wrapper, _Vec2);
_Vec2Wrapper.prototype = _Vec2.prototype;

export const Vec2: Vec2Constructor = _Vec2Wrapper;
