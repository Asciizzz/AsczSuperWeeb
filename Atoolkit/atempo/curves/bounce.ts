import { type Curve } from "../curve.js";

/**
 * Multi-stage ground bounce curve.
 */
export const bounce: Curve = (t: number): number => {
    let c = Math.max(0, Math.min(1, t));
    if (c < 1 / 2.75) {
        return 7.5625 * c * c;
    } else if (c < 2 / 2.75) {
        c -= 1.5 / 2.75;
        return 7.5625 * c * c + 0.75;
    } else if (c < 2.5 / 2.75) {
        c -= 2.25 / 2.75;
        return 7.5625 * c * c + 0.9375;
    } else {
        c -= 2.625 / 2.75;
        return 7.5625 * c * c + 0.984375;
    }
};
