/**
 * Analytical solution for damped harmonic oscillator dynamics across under-damped, critically damped, and over-damped regimes.
 */

export class Spring {
    frequency: number; // Natural frequency in Hz
    damping: number;   // Damping ratio (zeta): 1.0 = critical, <1.0 = under-damped, >1.0 = over-damped

    constructor(frequency = 2.0, damping = 0.7) {
        this.frequency = Math.max(0.001, frequency);
        this.damping = Math.max(0.0, damping);
    }

    /**
     * Updates scalar spring position and velocity in-place.
     * posVel[0] = position, posVel[1] = velocity.
     */
    update(posVel: Float32Array | number[], target: number, deltaSec: number): void {
        const dt = Math.max(0, deltaSec);
        if (dt === 0) return;

        const f = this.frequency;
        const z = this.damping;

        const w = f * (2.0 * Math.PI);
        const x = posVel[0] - target;
        const v = posVel[1];

        if (z < 0.9999) {
            // Under-damped oscillation
            const wd = w * Math.sqrt(1.0 - z * z);
            const exp = Math.exp(-z * w * dt);
            const c = Math.cos(wd * dt);
            const s = Math.sin(wd * dt);

            const newX = exp * (x * c + ((v + z * w * x) / wd) * s);
            const newV = exp * (v * c - ((v * z * w + w * w * x) / wd) * s);

            posVel[0] = newX + target;
            posVel[1] = newV;
        } else if (z > 1.0001) {
            // Over-damped decay
            const s = Math.sqrt(z * z - 1.0);
            const w1 = w * (z - s);
            const w2 = w * (z + s);
            const exp1 = Math.exp(-w1 * dt);
            const exp2 = Math.exp(-w2 * dt);

            const c1 = (v + w2 * x) / (2.0 * w * s);
            const c2 = (-v - w1 * x) / (2.0 * w * s);

            posVel[0] = c1 * exp1 + c2 * exp2 + target;
            posVel[1] = -c1 * w1 * exp1 - c2 * w2 * exp2;
        } else {
            // Critically damped
            const exp = Math.exp(-w * dt);
            const c2 = v + w * x;

            posVel[0] = (x + c2 * dt) * exp + target;
            posVel[1] = (v - c2 * w * dt) * exp;
        }
    }

    /**
     * Updates N-dimensional vector in-place.
     * posArray[posOffset .. posOffset + dim - 1] = positions
     * velArray[velOffset .. velOffset + dim - 1] = velocities
     */
    updateVector(
        posArray: Float32Array | number[],
        velArray: Float32Array | number[],
        targetArray: ArrayLike<number>,
        dimension: number,
        deltaSec: number,
        posOffset = 0,
        velOffset = 0,
        targetOffset = 0
    ): void {
        const temp = [0, 0];
        for (let d = 0; d < dimension; d++) {
            temp[0] = posArray[posOffset + d];
            temp[1] = velArray[velOffset + d];
            this.update(temp, targetArray[targetOffset + d], deltaSec);
            posArray[posOffset + d] = temp[0];
            velArray[velOffset + d] = temp[1];
        }
    }
}
