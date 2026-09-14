import { type Curve } from "../curve.js";

/**
 * Identity linear progress curve.
 */
export const linear: Curve = (t: number): number => t;
