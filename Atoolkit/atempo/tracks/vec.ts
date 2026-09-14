import { Track } from "../track.js";

/**
 * N-dimensional vector sequence track.
 */
export class VecTrack extends Track<ArrayLike<number>, Float32Array> {
    readonly dimension: number;

    constructor(dimension = 3, initialCapacity = 16) {
        super(initialCapacity);
        this.dimension = Math.max(1, Math.floor(dimension));
    }

    blend(a: ArrayLike<number>, b: ArrayLike<number>, alpha: number, out?: Float32Array): Float32Array {
        out ??= new Float32Array(this.dimension);
        const inv = 1.0 - alpha;
        for (let i = 0; i < this.dimension; i++) {
            const va = a[i] ?? 0;
            const vb = b[i] ?? 0;
            out[i] = va * inv + vb * alpha;
        }
        return out;
    }

    protected defaultValue(out?: Float32Array): Float32Array {
        out ??= new Float32Array(this.dimension);
        out.fill(0);
        return out;
    }
}
