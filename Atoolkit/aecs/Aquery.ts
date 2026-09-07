import type { Aent } from "./Aent.js";
import type { Acmp } from "../acmp/index.js";
import type { SparseSet } from "./SparseSet.js";
import type { Aecs } from "./Aecs.js";

/**
 * Constructor type for an Acmp subclass.
 */
export type AcmpClass<T extends Acmp = Acmp> = abstract new (...args: any[]) => T;

/**
 * Maps a tuple of Acmp constructor types to a tuple of their respective instance types.
 */
export type InferAcmpInstances<T extends readonly AcmpClass[]> = {
    [K in keyof T]: T[K] extends AcmpClass<infer U> ? U : never;
};

/**
 * Filtered iterator for entities possessing specified component combinations.
 *
 * Traversal uses the smallest sparse set as the driver loop, checking secondary
 * component sets in O(1) time.
 */
export class Aquery<TInstances extends readonly any[] = any[]> implements Iterable<[Aent, ...TInstances]> {
    private readonly ecs: Aecs;
    private readonly requiredTypes: AcmpClass[];
    private readonly withTypes: AcmpClass[] = [];
    private readonly excludedTypes: AcmpClass[] = [];
    private readonly anyTypes: AcmpClass[] = [];

    constructor(ecs: Aecs, requiredTypes: AcmpClass[]) {
        this.ecs = ecs;
        this.requiredTypes = [...requiredTypes];
    }

    /**
     * Excludes entities that possess any of the specified component types.
     */
    without(...types: AcmpClass[]): this {
        this.excludedTypes.push(...types);
        return this;
    }

    /**
     * Requires entities to possess the specified component types without yielding
     * them in the iteration tuple. Can accelerate traversal if smaller than required types.
     */
    with(...types: AcmpClass[]): this {
        this.withTypes.push(...types);
        return this;
    }

    /**
     * Restricts query to entities that possess at least one of the specified types.
     */
    some(...types: AcmpClass[]): this {
        this.anyTypes.push(...types);
        return this;
    }

    /**
     * Iterates over matching entities and their corresponding component instances.
     */
    *[Symbol.iterator](): Iterator<[Aent, ...TInstances]> {
        if (this.requiredTypes.length === 0 && this.withTypes.length === 0) {
            const living = this.ecs.allEntities();
            const len = living.length;
            for (let i = 0; i < len; i++) {
                const entity = living[i];
                if (!this.ecs.isAlive(entity)) continue;
                if (this.#isExcluded(entity)) continue;
                if (this.anyTypes.length > 0 && !this.#matchesAny(entity)) continue;
                yield [entity] as unknown as [Aent, ...TInstances];
            }
            return;
        }

        const requiredStores: SparseSet[] = [];
        const withStores: SparseSet[] = [];
        let smallestStore: SparseSet | null = null;
        let minSize = Infinity;

        // Gather required stores (yielded in tuple)
        for (let i = 0; i < this.requiredTypes.length; i++) {
            const store = this.ecs.getStore(this.requiredTypes[i]);
            if (!store || store.size === 0) return;
            requiredStores.push(store);
            if (store.size < minSize) {
                minSize = store.size;
                smallestStore = store;
            }
        }

        // Gather with stores (presence required, not yielded in tuple)
        for (let i = 0; i < this.withTypes.length; i++) {
            const store = this.ecs.getStore(this.withTypes[i]);
            if (!store || store.size === 0) return;
            withStores.push(store);
            if (store.size < minSize) {
                minSize = store.size;
                smallestStore = store;
            }
        }

        if (!smallestStore) return;

        // Snapshot candidate entities to guard against swap-and-pop mutations during iteration
        const candidates = smallestStore.entities.slice();
        const candidateCount = candidates.length;

        for (let i = 0; i < candidateCount; i++) {
            const entity = candidates[i];
            if (!this.ecs.isAlive(entity)) continue;

            // Check required stores
            let matchesAll = true;
            for (let j = 0; j < requiredStores.length; j++) {
                const store = requiredStores[j];
                if (!store.has(entity)) {
                    matchesAll = false;
                    break;
                }
            }
            if (!matchesAll) continue;

            // Check with stores
            for (let j = 0; j < withStores.length; j++) {
                const store = withStores[j];
                if (!store.has(entity)) {
                    matchesAll = false;
                    break;
                }
            }
            if (!matchesAll) continue;

            // Check excluded types
            if (this.#isExcluded(entity)) continue;

            // Check any (some) filter
            if (this.anyTypes.length > 0 && !this.#matchesAny(entity)) continue;

            // Assemble matching tuple: [entity, ...components] for requiredTypes only
            let hasAllComponents = true;
            const tuple = new Array(this.requiredTypes.length + 1) as [Aent, ...TInstances];
            tuple[0] = entity;
            for (let k = 0; k < requiredStores.length; k++) {
                const comp = requiredStores[k].get(entity);
                if (comp === null || comp === undefined) {
                    hasAllComponents = false;
                    break;
                }
                tuple[k + 1] = comp as any;
            }
            if (!hasAllComponents) continue;

            yield tuple;
        }
    }

    #isExcluded(entity: Aent): boolean {
        const len = this.excludedTypes.length;
        for (let i = 0; i < len; i++) {
            const store = this.ecs.getStore(this.excludedTypes[i]);
            if (store && store.has(entity)) return true;
        }
        return false;
    }

    #matchesAny(entity: Aent): boolean {
        const len = this.anyTypes.length;
        for (let i = 0; i < len; i++) {
            const store = this.ecs.getStore(this.anyTypes[i]);
            if (store && store.has(entity)) return true;
        }
        return false;
    }

    /**
     * Executes a callback for every matching entity.
     */
    forEach(fn: (entity: Aent, ...components: TInstances) => void): void {
        for (const item of this) {
            const entity = item[0];
            const cmps = item.slice(1) as unknown as TInstances;
            fn(entity, ...cmps);
        }
    }

    /**
     * Returns the first matching entity and components, or null if empty.
     */
    first(): [Aent, ...TInstances] | null {
        for (const item of this) {
            return item;
        }
        return null;
    }

    /**
     * Collects all matching entity identifiers into an array.
     */
    entities(): Aent[] {
        const result: Aent[] = [];
        for (const item of this) {
            result.push(item[0]);
        }
        return result;
    }

    /**
     * Returns the number of entities matching this query.
     */
    count(): number {
        let total = 0;
        for (const _ of this) {
            total++;
        }
        return total;
    }
}
