import { type Curve } from "../curve.js";

/**
 * Creates cubic Bezier curve from control points (x1, y1) and (x2, y2).
 * Solves parametric polynomial via Newton-Raphson with bisection fallback.
 */
export const bezier = (x1: number, y1: number, x2: number, y2: number): Curve => {
    const cx1 = Math.max(0, Math.min(1, x1));
    const cx2 = Math.max(0, Math.min(1, x2));

    const sampleX = (u: number): number =>
        (((1 - 3 * cx2 + 3 * cx1) * u + (3 * cx2 - 6 * cx1)) * u + 3 * cx1) * u;

    const sampleY = (u: number): number =>
        (((1 - 3 * y2 + 3 * y1) * u + (3 * y2 - 6 * y1)) * u + 3 * y1) * u;

    const derivativeX = (u: number): number =>
        3 * (1 - 3 * cx2 + 3 * cx1) * u * u + 2 * (3 * cx2 - 6 * cx1) * u + 3 * cx1;

    return (t: number): number => {
        if (t <= 0) return 0;
        if (t >= 1) return 1;

        let u = t;
        for (let i = 0; i < 8; i++) {
            const currentX = sampleX(u) - t;
            if (Math.abs(currentX) < 1e-6) break;
            const dX = derivativeX(u);
            if (Math.abs(dX) < 1e-6) break;
            u -= currentX / dX;
        }

        if (u < 0 || u > 1) {
            let low = 0;
            let high = 1;
            u = t;
            while (low < high) {
                const currentX = sampleX(u);
                if (Math.abs(currentX - t) < 1e-6) break;
                if (t > currentX) {
                    low = u;
                } else {
                    high = u;
                }
                u = (high + low) * 0.5;
            }
        }

        return sampleY(u);
    };
};
