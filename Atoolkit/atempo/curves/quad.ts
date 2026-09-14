import { type Curve } from "../curve.js";

/**
 * Quadratic ease-in curve.
 */
export const quadIn: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c * c;
};

/**
 * Quadratic ease-out curve.
 */
export const quadOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c * (2 - c);
};

/**
 * Quadratic ease-in-out curve.
 */
export const quadInOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c < 0.5 ? 2 * c * c : -1 + (4 - 2 * c) * c;
};
