import type { Entity } from "./Entity.js";

/**
 * Contiguous Float32Array component storage for high-frequency numeric data.
 *
 * Avoids object allocation and keeps numbers packed in a single typed array.
 * Operates standalone without any coordinator or god class.
 */
export class FloatSet {
    readonly stride: number;
    dense: Float32Array;
    entities: Entity[] = [];
    sparse: number[] = [];
    private _size = 0;

    constructor(stride: number, initialCapacity = 256) {
        if (stride <= 0) throw new Error("[FloatSet] Stride must be greater than 0.");
        this.stride = stride;
        this.dense = new Float32Array(initialCapacity * stride);
    }

    get size(): number {
        return this._size;
    }

    has(entity: Entity): boolean {
        const idx = this.sparse[entity];
        return idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity;
    }

    get(entity: Entity): Float32Array | undefined {
        const idx = this.sparse[entity];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            const offset = idx * this.stride;
            return this.dense.subarray(offset, offset + this.stride);
        }
        return undefined;
    }

    set(entity: Entity, values: ArrayLike<number>): this {
        let idx = this.sparse[entity];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            const offset = idx * this.stride;
            const len = Math.min(values.length, this.stride);
            for (let i = 0; i < len; i++) this.dense[offset + i] = values[i];
            return this;
        }

        // Expand buffer if capacity is reached
        if (this._size * this.stride >= this.dense.length) {
            const next = new Float32Array(this.dense.length * 2);
            next.set(this.dense);
            this.dense = next;
        }

        idx = this._size++;
        this.entities[idx] = entity;
        this.sparse[entity] = idx;
        const offset = idx * this.stride;
        const len = Math.min(values.length, this.stride);
        for (let i = 0; i < len; i++) this.dense[offset + i] = values[i];
        return this;
    }

    delete(entity: Entity): boolean {
        const idx = this.sparse[entity];
        if (idx === undefined || idx < 0 || idx >= this._size || this.entities[idx] !== entity) {
            return false;
        }

        const lastIdx = --this._size;
        if (idx < lastIdx) {
            const lastEntity = this.entities[lastIdx];
            const stride = this.stride;
            this.dense.copyWithin(idx * stride, lastIdx * stride, (lastIdx + 1) * stride);
            this.entities[idx] = lastEntity;
            this.sparse[lastEntity] = idx;
        }

        this.sparse[entity] = -1;
        return true;
    }

    clear(): void {
        this.sparse.fill(-1);
        this.entities.length = 0;
        this._size = 0;
    }

    each(fn: (entity: Entity, data: Float32Array) => void): void {
        const len = this._size;
        const stride = this.stride;
        for (let i = 0; i < len; i++) {
            const offset = i * stride;
            fn(this.entities[i], this.dense.subarray(offset, offset + stride));
        }
    }
}
