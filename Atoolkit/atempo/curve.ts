/**
 * Unary temporal progress shaping function.
 * Maps normalized interval progress t in [0, 1] to shaped evaluation alpha.
 */
export type Curve = (t: number) => number;
