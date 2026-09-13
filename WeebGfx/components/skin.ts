import type { Skeleton } from "../assets/skeleton.js";

/**
 * Pure data skeletal skinning component.
 * Stores skeleton asset reference and per-entity joint pose matrices.
 */
export class SkinCmp {
    skeleton: Skeleton;
    readonly jointPalette: Float32Array; // jointCount * 16 floats
    isDirty: boolean;

    constructor(skeleton: Skeleton) {
        this.skeleton = skeleton;
        this.jointPalette = new Float32Array(skeleton.jointCount * 16);
        // Default to identity matrices
        for (let i = 0; i < skeleton.jointCount; i++) {
            const base = i * 16;
            this.jointPalette[base + 0] = 1;
            this.jointPalette[base + 5] = 1;
            this.jointPalette[base + 10] = 1;
            this.jointPalette[base + 15] = 1;
        }
        this.isDirty = true;
    }

    setJointMatrix(jointIndex: number, matrix: Float32Array | number[]): this {
        const base = jointIndex * 16;
        for (let i = 0; i < 16; i++) {
            this.jointPalette[base + i] = matrix[i];
        }
        this.isDirty = true;
        return this;
    }
}
