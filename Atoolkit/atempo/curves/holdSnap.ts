import { type Curve } from "../curve.js";

/**
 * Creates hold threshold and snap curve.
 */
export const holdSnap = (holdFraction = 0.5, overshoot = 1.1): Curve => {
    return (t: number): number => {
        const c = Math.max(0, Math.min(1, t));
        if (c < holdFraction) return 0;
        const norm = (c - holdFraction) / (1 - holdFraction);
        if (norm < 0.25) return overshoot;
        return 1.0;
    };
};
