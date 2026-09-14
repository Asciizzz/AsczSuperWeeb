import { type Curve } from "../curve.js";

/**
 * Creates back overshoot curve expanding past 1.0 by specified amount before settling.
 */
export const overshoot = (amount = 1.15): Curve => {
    const s = amount * 1.70158;
    return (t: number): number => {
        const c = Math.max(0, Math.min(1, t));
        if (c <= 0) return 0;
        if (c >= 1) return 1;
        const p = c - 1;
        return p * p * ((s + 1) * p + s) + 1;
    };
};
