import { type Entity, entityIndex } from "./Entity.js";

/**
 * Contiguous Float32Array component storage for high-frequency numeric data.
 */
export class FloatSet implements Iterable<[Entity, Float32Array]> {
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
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        return idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity;
    }

    get(entity: Entity): Float32Array | undefined {
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            const offset = idx * this.stride;
            return this.dense.subarray(offset, offset + this.stride);
        }
        return undefined;
    }

    /**
     * Reads a single float component from the entity record without allocating a subarray view.
     */
    getDirect(entity: Entity, componentIndex: number): number | undefined {
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            if (componentIndex >= 0 && componentIndex < this.stride) {
                return this.dense[idx * this.stride + componentIndex];
            }
        }
        return undefined;
    }

    /**
     * Writes a single float component directly into dense memory without allocating an array.
     */
    setDirect(entity: Entity, componentIndex: number, value: number): boolean {
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            if (componentIndex >= 0 && componentIndex < this.stride) {
                this.dense[idx * this.stride + componentIndex] = value;
                return true;
            }
        }
        return false;
    }

    /**
     * Copies entity float record directly into destination buffer without creating intermediate views.
     */
    copyTo(entity: Entity, dst: Float32Array, dstOffset = 0): boolean {
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        if (idx !== undefined && idx >= 0 && idx < this._size && this.entities[idx] === entity) {
            const srcOffset = idx * this.stride;
            for (let i = 0; i < this.stride; i++) {
                dst[dstOffset + i] = this.dense[srcOffset + i];
            }
            return true;
        }
        return false;
    }

    set(entity: Entity, values: ArrayLike<number>): this {
        const slot = entityIndex(entity);
        let idx = this.sparse[slot];
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
        this.sparse[slot] = idx;
        const offset = idx * this.stride;
        const len = Math.min(values.length, this.stride);
        for (let i = 0; i < len; i++) this.dense[offset + i] = values[i];
        return this;
    }

    delete(entity: Entity): boolean {
        const slot = entityIndex(entity);
        const idx = this.sparse[slot];
        if (idx === undefined || idx < 0 || idx >= this._size || this.entities[idx] !== entity) {
            return false;
        }

        const lastIdx = --this._size;
        if (idx < lastIdx) {
            const lastEntity = this.entities[lastIdx];
            const stride = this.stride;
            this.dense.copyWithin(idx * stride, lastIdx * stride, (lastIdx + 1) * stride);
            this.entities[idx] = lastEntity;
            this.sparse[entityIndex(lastEntity)] = idx;
        }

        this.entities.pop();
        this.sparse[slot] = -1;
        return true;
    }

    clear(): void {
        this.sparse.length = 0;
        this.entities.length = 0;
        this._size = 0;
    }

    *[Symbol.iterator](): Iterator<[Entity, Float32Array]> {
        const len = this._size;
        const stride = this.stride;
        for (let i = 0; i < len; i++) {
            const offset = i * stride;
            yield [this.entities[i], this.dense.subarray(offset, offset + stride)];
        }
    }

    *keys(): IterableIterator<Entity> {
        const len = this._size;
        for (let i = 0; i < len; i++) {
            yield this.entities[i];
        }
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
