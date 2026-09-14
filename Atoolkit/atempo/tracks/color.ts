import { Track } from "../track.js";

export enum ColorSpace {
    PerceptualGamma = 0,
    Linear = 1,
}

/**
 * Color sequence track (RGB or RGBA) with perceptual gamma or linear blending.
 */
export class ColorTrack extends Track<ArrayLike<number>, Float32Array> {
    readonly dimension: number;
    readonly colorSpace: ColorSpace;

    /**
     * @param dimension Channel count: 3 for RGB, 4 for RGBA
     * @param colorSpace Color interpolation space
     */
    constructor(dimension = 4, colorSpace = ColorSpace.PerceptualGamma, initialCapacity = 16) {
        super(initialCapacity);
        this.dimension = dimension === 3 ? 3 : 4;
        this.colorSpace = colorSpace;
    }

    blend(a: ArrayLike<number>, b: ArrayLike<number>, alpha: number, out?: Float32Array): Float32Array {
        out ??= new Float32Array(this.dimension);
        const inv = 1.0 - alpha;

        if (this.colorSpace === ColorSpace.PerceptualGamma) {
            for (let i = 0; i < 3; i++) {
                const c0 = a[i] ?? 0;
                const c1 = b[i] ?? 0;
                out[i] = Math.sqrt(Math.max(0, inv * (c0 * c0) + alpha * (c1 * c1)));
            }
            if (this.dimension > 3) {
                out[3] = (a[3] ?? 1) * inv + (b[3] ?? 1) * alpha;
            }
        } else {
            for (let i = 0; i < this.dimension; i++) {
                out[i] = (a[i] ?? 0) * inv + (b[i] ?? 0) * alpha;
            }
        }

        return out;
    }

    protected defaultValue(out?: Float32Array): Float32Array {
        out ??= new Float32Array(this.dimension);
        out[0] = 1;
        out[1] = 1;
        out[2] = 1;
        if (this.dimension > 3) out[3] = 1;
        return out;
    }
}
