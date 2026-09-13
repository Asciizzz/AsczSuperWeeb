/**
 * CPU skeletal hierarchy asset.
 * Contains bone topology and rest-pose inverse bind matrices.
 */
export class Skeleton {
    readonly name: string;
    readonly jointNames: string[];
    readonly parentIndices: Int16Array;
    readonly inverseBindMatrices: Float32Array; // jointCount * 16 floats

    constructor(
        name: string,
        jointNames: string[],
        parentIndices: Int16Array | number[],
        inverseBindMatrices?: Float32Array
    ) {
        this.name = name;
        this.jointNames = jointNames;
        this.parentIndices = parentIndices instanceof Int16Array
            ? parentIndices
            : new Int16Array(parentIndices);

        const count = jointNames.length;
        if (inverseBindMatrices && inverseBindMatrices.length === count * 16) {
            this.inverseBindMatrices = inverseBindMatrices;
        } else {
            // Default to identity matrices
            this.inverseBindMatrices = new Float32Array(count * 16);
            for (let i = 0; i < count; i++) {
                const base = i * 16;
                this.inverseBindMatrices[base + 0] = 1;
                this.inverseBindMatrices[base + 5] = 1;
                this.inverseBindMatrices[base + 10] = 1;
                this.inverseBindMatrices[base + 15] = 1;
            }
        }
    }

    get jointCount(): number {
        return this.jointNames.length;
    }
}
