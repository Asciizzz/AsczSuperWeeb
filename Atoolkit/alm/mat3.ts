import { EPSILON } from "./constants.js";
import { Vec2 } from "./vec2.js";
import { Vec3 } from "./vec3.js";

/**
 * 3x3 Matrix stored as column-major Float32Array[9].
 *
 * Index mapping:
 *  0  3  6
 *  1  4  7
 *  2  5  8
 */
export class _Mat3 extends Float32Array {
    static get [Symbol.species](): Float32ArrayConstructor {
        return Float32Array;
    }

    static readonly IDENTITY: Readonly<_Mat3> = new _Mat3([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
    ]);

    constructor();
    constructor(elements: ArrayLike<number>);
    constructor(buffer: ArrayBufferLike, byteOffset?: number);
    constructor(a?: ArrayLike<number> | ArrayBufferLike, b?: number) {
        if (a instanceof ArrayBuffer || (typeof SharedArrayBuffer !== "undefined" && a instanceof SharedArrayBuffer)) {
            super(a as ArrayBuffer, b ?? 0, 9);
        } else {
            super(9);
            if (a && "length" in a) {
                const len = Math.min(a.length, 9);
                for (let i = 0; i < len; i++) {
                    this[i] = a[i];
                }
            } else {
                this[0] = 1;
                this[4] = 1;
                this[8] = 1;
            }
        }
    }

    static create(): _Mat3 {
        return new _Mat3();
    }

    static identity(out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        out[0] = 1; out[1] = 0; out[2] = 0;
        out[3] = 0; out[4] = 1; out[5] = 0;
        out[6] = 0; out[7] = 0; out[8] = 1;
        return out;
    }

    static view(buffer: ArrayBufferLike, byteOffset = 0): _Mat3 {
        return new _Mat3(buffer, byteOffset);
    }

    static fromArray(array: ArrayLike<number>, offset = 0, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        for (let i = 0; i < 9; i++) {
            out[i] = array[offset + i];
        }
        return out;
    }

    identity(): this {
        this[0] = 1; this[1] = 0; this[2] = 0;
        this[3] = 0; this[4] = 1; this[5] = 0;
        this[6] = 0; this[7] = 0; this[8] = 1;
        return this;
    }

    copy(src: ArrayLike<number>): this {
        for (let i = 0; i < 9; i++) {
            this[i] = src[i];
        }
        return this;
    }

    clone(): _Mat3 {
        return new _Mat3(this);
    }

    mul(b: ArrayLike<number>, out: _Mat3 = this): _Mat3 {
        const a00 = this[0], a01 = this[1], a02 = this[2];
        const a10 = this[3], a11 = this[4], a12 = this[5];
        const a20 = this[6], a21 = this[7], a22 = this[8];

        const b00 = b[0], b01 = b[1], b02 = b[2];
        const b10 = b[3], b11 = b[4], b12 = b[5];
        const b20 = b[6], b21 = b[7], b22 = b[8];

        out[0] = b00 * a00 + b01 * a10 + b02 * a20;
        out[1] = b00 * a01 + b01 * a11 + b02 * a21;
        out[2] = b00 * a02 + b01 * a12 + b02 * a22;

        out[3] = b10 * a00 + b11 * a10 + b12 * a20;
        out[4] = b10 * a01 + b11 * a11 + b12 * a21;
        out[5] = b10 * a02 + b11 * a12 + b12 * a22;

        out[6] = b20 * a00 + b21 * a10 + b22 * a20;
        out[7] = b20 * a01 + b21 * a11 + b22 * a21;
        out[8] = b20 * a02 + b21 * a12 + b22 * a22;

        return out;
    }

    multiply(b: ArrayLike<number>, out: _Mat3 = this): _Mat3 {
        return this.mul(b, out);
    }

    transpose(out: _Mat3 = this): _Mat3 {
        if (out === this) {
            const a01 = this[1], a02 = this[2], a12 = this[5];
            this[1] = this[3];
            this[2] = this[6];
            this[3] = a01;
            this[5] = this[7];
            this[6] = a02;
            this[7] = a12;
            return this;
        }
        out[0] = this[0]; out[1] = this[3]; out[2] = this[6];
        out[3] = this[1]; out[4] = this[4]; out[5] = this[7];
        out[6] = this[2]; out[7] = this[5]; out[8] = this[8];
        return out;
    }

    determinant(): number {
        const a00 = this[0], a01 = this[1], a02 = this[2];
        const a10 = this[3], a11 = this[4], a12 = this[5];
        const a20 = this[6], a21 = this[7], a22 = this[8];

        return (
            a00 * (a22 * a11 - a12 * a21) +
            a01 * (-a22 * a10 + a12 * a20) +
            a02 * (a21 * a10 - a11 * a20)
        );
    }

    invert(out: _Mat3 = this): _Mat3 | null {
        const a00 = this[0], a01 = this[1], a02 = this[2];
        const a10 = this[3], a11 = this[4], a12 = this[5];
        const a20 = this[6], a21 = this[7], a22 = this[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        let det = a00 * b01 + a01 * b11 + a02 * b21;
        if (Math.abs(det) <= EPSILON) return null;
        det = 1.0 / det;

        out[0] = b01 * det;
        out[1] = (-a22 * a01 + a02 * a21) * det;
        out[2] = (a12 * a01 - a02 * a11) * det;
        out[3] = b11 * det;
        out[4] = (a22 * a00 - a02 * a20) * det;
        out[5] = (-a12 * a00 + a02 * a10) * det;
        out[6] = b21 * det;
        out[7] = (-a21 * a00 + a01 * a20) * det;
        out[8] = (a11 * a00 - a01 * a10) * det;
        return out;
    }

    static fromMat4(m: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        out[0] = m[0]; out[1] = m[1]; out[2] = m[2];
        out[3] = m[4]; out[4] = m[5]; out[5] = m[6];
        out[6] = m[8]; out[7] = m[9]; out[8] = m[10];
        return out;
    }

    /**
     * Computes the 3x3 normal matrix (inverse transpose of the upper-left 3x3 of a 4x4 matrix).
     * Essential for vertex normal transformation in shaders under non-uniform scaling.
     */
    static normalMatrix(m: ArrayLike<number>, out?: _Mat3): _Mat3 | null {
        out ??= new _Mat3();
        const a00 = m[0], a01 = m[1], a02 = m[2];
        const a10 = m[4], a11 = m[5], a12 = m[6];
        const a20 = m[8], a21 = m[9], a22 = m[10];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        let det = a00 * b01 + a01 * b11 + a02 * b21;
        if (Math.abs(det) <= EPSILON) return null;
        det = 1.0 / det;

        out[0] = b01 * det;
        out[1] = (-a22 * a01 + a02 * a21) * det;
        out[2] = (a12 * a01 - a02 * a11) * det;
        out[3] = b11 * det;
        out[4] = (a22 * a00 - a02 * a20) * det;
        out[5] = (-a12 * a00 + a02 * a10) * det;
        out[6] = b21 * det;
        out[7] = (-a21 * a00 + a01 * a20) * det;
        out[8] = (a11 * a00 - a01 * a10) * det;
        return out;
    }

    static fromQuat(q: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        const x = q[0], y = q[1], z = q[2], w = q[3];
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, yx = y * x2, yy = y * y2;
        const zx = z * x2, zy = z * y2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        out[0] = 1 - yy - zz;
        out[1] = yx + wz;
        out[2] = zx - wy;

        out[3] = yx - wz;
        out[4] = 1 - xx - zz;
        out[5] = zy + wx;

        out[6] = zx + wy;
        out[7] = zy - wx;
        out[8] = 1 - xx - yy;
        return out;
    }

    static fromTranslation2D(v: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        out[0] = 1; out[1] = 0; out[2] = 0;
        out[3] = 0; out[4] = 1; out[5] = 0;
        out[6] = v[0]; out[7] = v[1]; out[8] = 1;
        return out;
    }

    static fromRotation2D(rad: number, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        const s = Math.sin(rad), c = Math.cos(rad);
        out[0] = c;  out[1] = s;  out[2] = 0;
        out[3] = -s; out[4] = c;  out[5] = 0;
        out[6] = 0;  out[7] = 0;  out[8] = 1;
        return out;
    }

    static fromScaling2D(v: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        out[0] = v[0]; out[1] = 0;    out[2] = 0;
        out[3] = 0;    out[4] = v[1]; out[5] = 0;
        out[6] = 0;    out[7] = 0;    out[8] = 1;
        return out;
    }

    translate2D(v: ArrayLike<number>, out: _Mat3 = this): _Mat3 {
        const x = v[0], y = v[1];
        out[6] = this[0] * x + this[3] * y + this[6];
        out[7] = this[1] * x + this[4] * y + this[7];
        out[8] = this[2] * x + this[5] * y + this[8];
        return out;
    }

    rotate2D(rad: number, out: _Mat3 = this): _Mat3 {
        const a00 = this[0], a01 = this[1], a02 = this[2];
        const a10 = this[3], a11 = this[4], a12 = this[5];
        const s = Math.sin(rad), c = Math.cos(rad);

        out[0] = c * a00 + s * a10;
        out[1] = c * a01 + s * a11;
        out[2] = c * a02 + s * a12;

        out[3] = c * a10 - s * a00;
        out[4] = c * a11 - s * a01;
        out[5] = c * a12 - s * a02;
        return out;
    }

    scale2D(v: ArrayLike<number>, out: _Mat3 = this): _Mat3 {
        const x = v[0], y = v[1];
        out[0] = this[0] * x;
        out[1] = this[1] * x;
        out[2] = this[2] * x;

        out[3] = this[3] * y;
        out[4] = this[4] * y;
        out[5] = this[5] * y;
        return out;
    }

    transformVec2(v: ArrayLike<number>, out?: Vec2): Vec2 {
        out ??= new Vec2();
        const x = v[0], y = v[1];
        out[0] = this[0] * x + this[3] * y + this[6];
        out[1] = this[1] * x + this[4] * y + this[7];
        return out;
    }

    transformVec3(v: ArrayLike<number>, out?: Vec3): Vec3 {
        out ??= new Vec3();
        const x = v[0], y = v[1], z = v[2];
        out[0] = this[0] * x + this[3] * y + this[6] * z;
        out[1] = this[1] * x + this[4] * y + this[7] * z;
        out[2] = this[2] * x + this[5] * y + this[8] * z;
        return out;
    }

    equals(b: ArrayLike<number>, epsilon = EPSILON): boolean {
        for (let i = 0; i < 9; i++) {
            if (Math.abs(this[i] - b[i]) > epsilon) return false;
        }
        return true;
    }

    exactEquals(b: ArrayLike<number>): boolean {
        for (let i = 0; i < 9; i++) {
            if (this[i] !== b[i]) return false;
        }
        return true;
    }

    // Static procedural API
    static mul(a: ArrayLike<number>, b: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        const a00 = a[0], a01 = a[1], a02 = a[2];
        const a10 = a[3], a11 = a[4], a12 = a[5];
        const a20 = a[6], a21 = a[7], a22 = a[8];

        const b00 = b[0], b01 = b[1], b02 = b[2];
        const b10 = b[3], b11 = b[4], b12 = b[5];
        const b20 = b[6], b21 = b[7], b22 = b[8];

        out[0] = b00 * a00 + b01 * a10 + b02 * a20;
        out[1] = b00 * a01 + b01 * a11 + b02 * a21;
        out[2] = b00 * a02 + b01 * a12 + b02 * a22;

        out[3] = b10 * a00 + b11 * a10 + b12 * a20;
        out[4] = b10 * a01 + b11 * a11 + b12 * a21;
        out[5] = b10 * a02 + b11 * a12 + b12 * a22;

        out[6] = b20 * a00 + b21 * a10 + b22 * a20;
        out[7] = b20 * a01 + b21 * a11 + b22 * a21;
        out[8] = b20 * a02 + b21 * a12 + b22 * a22;

        return out;
    }

    static transpose(a: ArrayLike<number>, out?: _Mat3): _Mat3 {
        out ??= new _Mat3();
        out[0] = a[0]; out[1] = a[3]; out[2] = a[6];
        out[3] = a[1]; out[4] = a[4]; out[5] = a[7];
        out[6] = a[2]; out[7] = a[5]; out[8] = a[8];
        return out;
    }

    static invert(a: ArrayLike<number>, out?: _Mat3): _Mat3 | null {
        out ??= new _Mat3();
        const a00 = a[0], a01 = a[1], a02 = a[2];
        const a10 = a[3], a11 = a[4], a12 = a[5];
        const a20 = a[6], a21 = a[7], a22 = a[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        let det = a00 * b01 + a01 * b11 + a02 * b21;
        if (Math.abs(det) <= EPSILON) return null;
        det = 1.0 / det;

        out[0] = b01 * det;
        out[1] = (-a22 * a01 + a02 * a21) * det;
        out[2] = (a12 * a01 - a02 * a11) * det;
        out[3] = b11 * det;
        out[4] = (a22 * a00 - a02 * a20) * det;
        out[5] = (-a12 * a00 + a02 * a10) * det;
        out[6] = b21 * det;
        out[7] = (-a21 * a00 + a01 * a20) * det;
        out[8] = (a11 * a00 - a01 * a10) * det;
        return out;
    }

    static equals(a: ArrayLike<number>, b: ArrayLike<number>, epsilon = EPSILON): boolean {
        for (let i = 0; i < 9; i++) {
            if (Math.abs(a[i] - b[i]) > epsilon) return false;
        }
        return true;
    }

    static exactEquals(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
        for (let i = 0; i < 9; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }
}

export type Mat3 = _Mat3;

export interface Mat3Factory {
    new (): Mat3;
    new (elements: ArrayLike<number>): Mat3;
    new (buffer: ArrayBufferLike, byteOffset?: number): Mat3;

    (): Mat3;
    (elements?: ArrayLike<number>): Mat3;
    (buffer: ArrayBufferLike, byteOffset?: number): Mat3;
}

export type Mat3Constructor = typeof _Mat3 & Mat3Factory;

const _Mat3Wrapper: any = function (
    a?: ArrayLike<number> | ArrayBufferLike,
    b?: number
): Mat3 {
    return new _Mat3(a as any, b);
};
Object.setPrototypeOf(_Mat3Wrapper, _Mat3);
_Mat3Wrapper.prototype = _Mat3.prototype;

export const Mat3: Mat3Constructor = _Mat3Wrapper;
