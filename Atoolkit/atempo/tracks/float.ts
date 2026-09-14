import { Track } from "../track.js";

/**
 * Scalar floating-point sequence track.
 */
export class FloatTrack extends Track<number, number> {
    blend(a: number, b: number, alpha: number): number {
        return a + (b - a) * alpha;
    }

    protected defaultValue(): number {
        return 0;
    }
}
