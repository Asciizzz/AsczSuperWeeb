import { type Curve } from "../curve.js";

/**
 * Exponential ease-in curve.
 */
export const expoIn: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c === 0 ? 0 : Math.pow(2, 10 * (c - 1));
};

/**
 * Exponential ease-out curve.
 */
export const expoOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    return c === 1 ? 1 : 1 - Math.pow(2, -10 * c);
};

/**
 * Exponential ease-in-out curve.
 */
export const expoInOut: Curve = (t: number): number => {
    const c = Math.max(0, Math.min(1, t));
    if (c === 0) return 0;
    if (c === 1) return 1;
    return c < 0.5 ? 0.5 * Math.pow(2, 20 * c - 10) : 1 - 0.5 * Math.pow(2, -20 * c + 10);
};
