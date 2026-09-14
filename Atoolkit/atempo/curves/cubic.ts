import { type Curve } from "../curve.js";

/**
 * Cubic ease-in curve.
 */
export const cubicIn: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c * c * c;
};

/**
 * Cubic ease-out curve.
 */
export const cubicOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t)) - 1;
    return c * c * c + 1;
};

/**
 * Cubic ease-in-out curve.
 */
export const cubicInOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c < 0.5 ? 4 * c * c * c : (c - 1) * (2 * c - 2) * (2 * c - 2) + 1;
};
