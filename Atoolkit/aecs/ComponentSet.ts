import type { Entity } from "./Entity.js";

/**
 * Contiguous component set indexed by Entity.
 *
 * Provides O(1) set, get, has, and delete via sparse-dense indexing.
 * Operates standalone without any coordinator or god class.
 */
export class ComponentSet<T> implements Iterable<[Entity, T]> {
    readonly dense: T[] = [];
    readonly entities: Entity[] = [];
    readonly sparse: number[] = [];

    get size(): number {
        return this.dense.length;
    }

    has(entity: Entity): boolean {
        const denseIdx = this.sparse[entity];
        return denseIdx !== undefined && denseIdx >= 0 && denseIdx < this.dense.length && this.entities[denseIdx] === entity;
    }

    get(entity: Entity): T | undefined {
        const denseIdx = this.sparse[entity];
        if (denseIdx !== undefined && denseIdx >= 0 && denseIdx < this.dense.length && this.entities[denseIdx] === entity) {
            return this.dense[denseIdx];
        }
        return undefined;
    }

    set(entity: Entity, value: T): this {
        const denseIdx = this.sparse[entity];
        if (denseIdx !== undefined && denseIdx >= 0 && denseIdx < this.dense.length && this.entities[denseIdx] === entity) {
            this.dense[denseIdx] = value;
            return this;
        }

        const newIdx = this.dense.length;
        this.dense.push(value);
        this.entities.push(entity);
        this.sparse[entity] = newIdx;
        return this;
    }

    delete(entity: Entity): boolean {
        const denseIdx = this.sparse[entity];
        if (denseIdx === undefined || denseIdx < 0 || denseIdx >= this.dense.length || this.entities[denseIdx] !== entity) {
            return false;
        }

        const lastIdx = this.dense.length - 1;
        if (denseIdx < lastIdx) {
            const lastEntity = this.entities[lastIdx];
            const lastVal = this.dense[lastIdx];
            this.dense[denseIdx] = lastVal;
            this.entities[denseIdx] = lastEntity;
            this.sparse[lastEntity] = denseIdx;
        }

        this.dense.pop();
        this.entities.pop();
        this.sparse[entity] = -1;
        return true;
    }

    clear(): void {
        this.dense.length = 0;
        this.entities.length = 0;
        this.sparse.length = 0;
    }

    *[Symbol.iterator](): Iterator<[Entity, T]> {
        const len = this.dense.length;
        for (let i = 0; i < len; i++) {
            yield [this.entities[i], this.dense[i]];
        }
    }

    each(fn: (entity: Entity, value: T) => void): void {
        const len = this.dense.length;
        for (let i = 0; i < len; i++) {
            fn(this.entities[i], this.dense[i]);
        }
    }
}
