/**
 * Periodic phase coordinates, waveform generators, and cyclic metronomic tracking.
 */

export class Phase {
    private static readonly TWO_PI = Math.PI * 2.0;

    /**
     * Converts time and frequency into normalized cyclic phase in [0.0, 1.0).
     */
    static cycle(timeSec: number, frequencyHz: number, phaseOffset = 0.0): number {
        if (frequencyHz <= 0) return 0.0;
        const raw = timeSec * frequencyHz + phaseOffset;
        return raw - Math.floor(raw);
    }

    /**
     * Normalized sine wave over phase [0.0, 1.0) mapped to [-1.0, 1.0].
     */
    static sine(phase: number): number {
        return Math.sin(phase * Phase.TWO_PI);
    }

    /**
     * Normalized cosine wave over phase [0.0, 1.0) mapped to [-1.0, 1.0].
     */
    static cosine(phase: number): number {
        return Math.cos(phase * Phase.TWO_PI);
    }

    /**
     * Symmetric triangle wave over phase [0.0, 1.0) mapped to [-1.0, 1.0].
     */
    static triangle(phase: number): number {
        const p = phase - Math.floor(phase);
        return 1.0 - 4.0 * Math.abs(p - 0.5);
    }

    /**
     * Linear ramp sawtooth wave over phase [0.0, 1.0) mapped to [-1.0, 1.0].
     */
    static saw(phase: number): number {
        const p = phase - Math.floor(phase);
        return 2.0 * p - 1.0;
    }

    /**
     * Square pulse wave over phase [0.0, 1.0) mapped to [-1.0, 1.0].
     */
    static square(phase: number, dutyCycle = 0.5): number {
        const p = phase - Math.floor(phase);
        return p < dutyCycle ? 1.0 : -1.0;
    }

    /**
     * Exponential decay impulse starting at 1.0 at phase 0.0 and decaying toward 0.0.
     */
    static impulse(phase: number, sharpness = 4.0): number {
        const p = phase - Math.floor(phase);
        return Math.exp(-sharpness * p);
    }

    /**
     * Wraps scalar value into [min, max) range.
     */
    static wrap(value: number, min: number, max: number): number {
        const range = max - min;
        if (range <= 0) return min;
        return min + ((((value - min) % range) + range) % range);
    }
}

export interface MetronomeState {
    cycle: number;
    phase: number;
    bar: number;
    justTriggered: boolean;
    impulse: number;
}

/**
 * Periodic beat and bar tracker.
 * Evaluates integer cycles, phase progress in [0, 1), and boundary triggers.
 */
export class Metronome {
    private _frequency = 1.0;
    private _lastCycle = 0;
    private _justTriggered = false;

    constructor(frequencyOrBpm = 120, isBpm = true) {
        if (isBpm) {
            this.setBpm(frequencyOrBpm);
        } else {
            this.setFrequency(frequencyOrBpm);
        }
    }

    setBpm(bpm: number): this {
        this._frequency = Math.max(0.0001, bpm / 60.0);
        return this;
    }

    setFrequency(hz: number): this {
        this._frequency = Math.max(0.0001, hz);
        return this;
    }

    get frequency(): number {
        return this._frequency;
    }

    get bpm(): number {
        return this._frequency * 60.0;
    }

    get period(): number {
        return 1.0 / this._frequency;
    }

    /**
     * Evaluates metronome state for timestamp and updates cycle boundary trigger.
     */
    sample(timeSec: number): MetronomeState {
        const totalCycles = timeSec * this._frequency;
        const currentCycle = Math.floor(totalCycles);
        const phase = totalCycles - currentCycle;
        const bar = Math.floor(currentCycle / 4);

        this._justTriggered = currentCycle !== this._lastCycle;
        this._lastCycle = currentCycle;

        const impulse = Math.pow(Math.max(0.0, 1.0 - phase * 3.5), 2.2);

        return {
            cycle: currentCycle,
            phase,
            bar,
            justTriggered: this._justTriggered,
            impulse,
        };
    }

    get justTriggered(): boolean {
        return this._justTriggered;
    }
}
