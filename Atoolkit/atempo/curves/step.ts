import { type Curve } from "../curve.js";

/**
 * Creates staircase quantization curve mapping [0, 1] into discrete steps.
 */
export const step = (steps = 4): Curve => {
    const s = Math.max(1, Math.floor(steps));
    return (t: number): number => {
        const clamped = Math.max(0, Math.min(1, t));
        return Math.floor(clamped * s) / s;
    };
};
