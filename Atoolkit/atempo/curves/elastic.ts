import { type Curve } from "../curve.js";

/**
 * Exponentially decaying elastic oscillation curve.
 */
export const elastic: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    if (c === 0 || c === 1) return c;
    const p = 0.3;
    const s = p / 4;
    return Math.pow(2, -10 * c) * Math.sin(((c - s) * (2 * Math.PI)) / p) + 1;
};
