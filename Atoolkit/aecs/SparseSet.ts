import type { Aent } from "./Aent.js";
import { aentIndex } from "./Aent.js";
import type { Acmp } from "../acmp/index.js";

/**
 * Dense-sparse storage for a single component type.
 *
 * Provides O(1) insertion, lookup, and swap-and-pop deletion.
 * Components are kept tightly packed in the `dense` array for cache-friendly, contiguous iteration.
 */
export class SparseSet<T extends Acmp = Acmp> {
    /** Tightly packed array of component instances */
    readonly dense: T[] = [];

    /** Entity identifiers corresponding 1:1 to items in `dense` */
    readonly entities: Aent[] = [];

    /** Maps entity slot index -> dense array index (-1 when not present) */
    readonly sparse: number[] = [];

    /**
     * Number of stored component instances.
     */
    get size(): number {
        return this.dense.length;
    }

    /**
     * Checks whether an entity currently holds a component in this set.
     */
    has(entity: Aent): boolean {
        const idx = aentIndex(entity);
        const denseIdx = this.sparse[idx];
        return denseIdx !== undefined && denseIdx < this.dense.length && this.entities[denseIdx] === entity;
    }

    /**
     * Retrieves the component instance attached to an entity, or null if absent.
     */
    get(entity: Aent): T | null {
        const idx = aentIndex(entity);
        const denseIdx = this.sparse[idx];
        if (denseIdx !== undefined && denseIdx < this.dense.length && this.entities[denseIdx] === entity) {
            return this.dense[denseIdx];
        }
        return null;
    }

    /**
     * Inserts or overwrites the component instance for an entity.
     */
    set(entity: Aent, component: T): void {
        const idx = aentIndex(entity);
        const denseIdx = this.sparse[idx];
        if (denseIdx !== undefined && denseIdx < this.dense.length && this.entities[denseIdx] === entity) {
            this.dense[denseIdx] = component;
            return;
        }

        const newDenseIdx = this.dense.length;
        this.dense.push(component);
        this.entities.push(entity);
        this.sparse[idx] = newDenseIdx;
    }

    /**
     * Removes the component for an entity using swap-and-pop.
     * Preserves contiguous memory layout without holes.
     */
    remove(entity: Aent): boolean {
        const idx = aentIndex(entity);
        const denseIdx = this.sparse[idx];
        if (denseIdx === undefined || denseIdx >= this.dense.length || this.entities[denseIdx] !== entity) {
            return false;
        }

        const lastDenseIdx = this.dense.length - 1;
        if (denseIdx < lastDenseIdx) {
            const lastEntity = this.entities[lastDenseIdx];
            const lastComponent = this.dense[lastDenseIdx];

            this.dense[denseIdx] = lastComponent;
            this.entities[denseIdx] = lastEntity;
            this.sparse[aentIndex(lastEntity)] = denseIdx;
        }

        this.dense.pop();
        this.entities.pop();
        this.sparse[idx] = -1;
        return true;
    }

    /**
     * Removes all components and resets storage.
     */
    clear(): void {
        this.dense.length = 0;
        this.entities.length = 0;
        this.sparse.length = 0;
    }

    /**
     * Iterates over dense components with contiguous memory access.
     */
    forEach(fn: (component: T, entity: Aent, index: number) => void): void {
        const len = this.dense.length;
        for (let i = 0; i < len; i++) {
            fn(this.dense[i], this.entities[i], i);
        }
    }
}
