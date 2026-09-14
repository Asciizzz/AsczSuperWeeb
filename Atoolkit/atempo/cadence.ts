/**
 * Temporal stepping, decay convergence, and damping operators.
 */

export class Cadence {
    /**
     * Quantizes continuous timestamp into discrete stepped intervals.
     */
    static quantizeTime(time: number, targetFps: number): number {
        if (targetFps <= 0) return time;
        return Math.floor(time * targetFps) / targetFps;
    }

    /**
     * Exponential half-life decay.
     * Converges toward target such that remaining distance halves every halfLife seconds.
     *
     * @param current Current value
     * @param target Destination value
     * @param halfLife Duration in seconds to close half the remaining gap
     * @param deltaSec Elapsed frame time in seconds
     */
    static decay(current: number, target: number, halfLife: number, deltaSec: number): number {
        if (halfLife <= 0) return target;
        const decayFactor = Math.exp((-0.69314718056 * deltaSec) / halfLife);
        return target + (current - target) * decayFactor;
    }

    /**
     * Critically damped spring follower.
     * Drives current towards target over smoothTime. Mutates velocityRef[0] in-place.
     *
     * @param current Current position
     * @param target Target position
     * @param velocityRef Array containing velocity at index 0
     * @param smoothTime Expected duration in seconds to reach target
     * @param deltaSec Elapsed time in seconds
     * @param maxSpeed Maximum velocity clamp
     */
    static damp(
        current: number,
        target: number,
        velocityRef: Float32Array | number[],
        smoothTime: number,
        deltaSec: number,
        maxSpeed = Number.POSITIVE_INFINITY
    ): number {
        const omega = 2 / Math.max(0.0001, smoothTime);
        const x = omega * deltaSec;
        const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

        let change = current - target;
        const originalTo = target;

        const maxChange = maxSpeed * smoothTime;
        change = Math.max(-maxChange, Math.min(maxChange, change));
        target = current - change;

        const temp = (velocityRef[0] + omega * change) * deltaSec;
        velocityRef[0] = (velocityRef[0] - omega * temp) * exp;
        let output = target + (change + temp) * exp;

        if (originalTo - current > 0 === output > originalTo) {
            output = originalTo;
            velocityRef[0] = (output - originalTo) / deltaSec;
        }

        return output;
    }

    /**
     * Rejects updates where value change is below threshold.
     */
    static hysteresis(current: number, target: number, threshold: number): number {
        return Math.abs(target - current) >= threshold ? target : current;
    }

    /**
     * Checks whether elapsed duration exceeds cooldown interval.
     */
    static debounce(time: number, lastTriggerTime: number, cooldown: number): boolean {
        return time - lastTriggerTime >= cooldown;
    }
}

/**
 * Fixed timestep simulation accumulator.
 * Accumulates variable delta times into deterministic discrete steps with fractional alpha.
 */
export class FixedCadence {
    readonly fixedDelta: number;
    readonly maxSubSteps: number;
    private accumulator = 0;
    private simulationTime = 0;

    constructor(targetHz = 60, maxSubSteps = 5) {
        this.fixedDelta = 1 / Math.max(1, targetHz);
        this.maxSubSteps = Math.max(1, maxSubSteps);
    }

    /**
     * Accumulates deltaSec and invokes stepCallback for each discrete step.
     * Returns fractional alpha in [0, 1) for state interpolation.
     */
    update(deltaSec: number, stepCallback: (fixedDelta: number, simTime: number) => void): number {
        const clampedDelta = Math.min(0.2, Math.max(0, deltaSec));
        this.accumulator += clampedDelta;

        let steps = 0;
        while (this.accumulator >= this.fixedDelta && steps < this.maxSubSteps) {
            stepCallback(this.fixedDelta, this.simulationTime);
            this.simulationTime += this.fixedDelta;
            this.accumulator -= this.fixedDelta;
            steps++;
        }

        if (steps >= this.maxSubSteps) {
            this.accumulator = 0;
        }

        return this.accumulator / this.fixedDelta;
    }

    get totalSimulationTime(): number {
        return this.simulationTime;
    }

    reset(): void {
        this.accumulator = 0;
        this.simulationTime = 0;
    }
}
