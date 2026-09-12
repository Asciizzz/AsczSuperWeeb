import type { Aent } from "./Aent.js";
import type { SparseSet } from "./SparseSet.js";
import type { Aecs } from "./Aecs.js";

/**
 * Constructor type for an Acmp subclass.
 */
export type ComponentClass<T extends object = object> = abstract new (...args: any[]) => T;

/**
 * Maps a tuple of Acmp constructor types to a tuple of their respective instance types.
 */
export type InferComponentInstances<T extends readonly ComponentClass[]> = {
    [K in keyof T]: T[K] extends ComponentClass<infer U> ? U : never;
};

/**
 * Filtered iterator for entities possessing specified component combinations.
 *
 * Traversal uses the smallest sparse set as the driver loop,
 * checking secondary component sets in O(1) time.
 */
export class Aquery<TInstances extends readonly object[] = object[]> implements Iterable<[Aent, ...TInstances]> {
    private readonly ecs: Aecs;
    private readonly requiredTypes: ComponentClass[];
    private readonly withTypes: ComponentClass[] = [];
    private readonly excludedTypes: ComponentClass[] = [];
    private readonly anyTypes: ComponentClass[] = [];
    private readonly _reqStores: SparseSet[] = [];
    private readonly _withStores: SparseSet[] = [];

    constructor(ecs: Aecs, requiredTypes: ComponentClass[]) {
        this.ecs = ecs;
        this.requiredTypes = [...requiredTypes];
    }

    /**
     * Excludes entities that possess any of the specified component types.
     */
    without(...types: ComponentClass[]): this {
        this.excludedTypes.push(...types);
        return this;
    }

    /**
     * Requires entities to possess the specified component types without yielding
     * them in the iteration tuple. Can accelerate traversal if smaller than required types.
     */
    with(...types: ComponentClass[]): this {
        this.withTypes.push(...types);
        return this;
    }

    /**
     * Restricts query to entities that possess at least one of the specified types.
     */
    some(...types: ComponentClass[]): this {
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

        const candidates = smallestStore.entities;
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
     * Executes a callback for every matching entity without allocating generator or tuple objects.
     */
    forEach(fn: (entity: Aent, ...components: TInstances) => void): void {
        if (this.requiredTypes.length === 0 && this.withTypes.length === 0) {
            this.ecs.forEachEntity((entity) => {
                if (this.#isExcluded(entity)) return;
                if (this.anyTypes.length > 0 && !this.#matchesAny(entity)) return;
                (fn as unknown as (entity: Aent) => void)(entity);
            });
            return;
        }

        const requiredStores = this._reqStores;
        const withStores = this._withStores;
        requiredStores.length = 0;
        withStores.length = 0;
        let smallestStore: SparseSet | null = null;
        let minSize = Infinity;

        for (let i = 0; i < this.requiredTypes.length; i++) {
            const store = this.ecs.getStore(this.requiredTypes[i]);
            if (!store || store.size === 0) return;
            requiredStores.push(store);
            if (store.size < minSize) {
                minSize = store.size;
                smallestStore = store;
            }
        }

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

        const candidates = smallestStore.entities;
        const reqLen = requiredStores.length;
        const withLen = withStores.length;
        const hasAny = this.anyTypes.length > 0;

        for (let i = 0; i < candidates.length; i++) {
            const entity = candidates[i];
            if (!this.ecs.isAlive(entity)) continue;

            let matchesAll = true;
            for (let j = 0; j < reqLen; j++) {
                if (!requiredStores[j].has(entity)) {
                    matchesAll = false;
                    break;
                }
            }
            if (!matchesAll) continue;

            for (let j = 0; j < withLen; j++) {
                if (!withStores[j].has(entity)) {
                    matchesAll = false;
                    break;
                }
            }
            if (!matchesAll) continue;

            if (this.#isExcluded(entity)) continue;
            if (hasAny && !this.#matchesAny(entity)) continue;

            if (reqLen === 0) {
                (fn as unknown as (e: Aent) => void)(entity);
            } else if (reqLen === 1) {
                const c0 = requiredStores[0].get(entity);
                if (c0 != null) (fn as unknown as (e: Aent, a: unknown) => void)(entity, c0);
            } else if (reqLen === 2) {
                const c0 = requiredStores[0].get(entity);
                const c1 = requiredStores[1].get(entity);
                if (c0 != null && c1 != null) (fn as unknown as (e: Aent, a: unknown, b: unknown) => void)(entity, c0, c1);
            } else if (reqLen === 3) {
                const c0 = requiredStores[0].get(entity);
                const c1 = requiredStores[1].get(entity);
                const c2 = requiredStores[2].get(entity);
                if (c0 != null && c1 != null && c2 != null) (fn as unknown as (e: Aent, a: unknown, b: unknown, c: unknown) => void)(entity, c0, c1, c2);
            } else {
                const args: any[] = new Array(reqLen);
                let valid = true;
                for (let k = 0; k < reqLen; k++) {
                    const c = requiredStores[k].get(entity);
                    if (c == null) { valid = false; break; }
                    args[k] = c;
                }
                if (valid) fn(entity, ...args as unknown as TInstances);
            }
        }
    }

    /**
     * Alias for forEach zero-allocation traversal.
     */
    each(fn: (entity: Aent, ...components: TInstances) => void): void {
        this.forEach(fn);
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
        this.forEach((entity: Aent, ..._cmps: TInstances) => {
            result.push(entity);
        });
        return result;
    }

    /**
     * Returns the number of entities matching this query.
     */
    count(): number {
        let total = 0;
        this.forEach((_entity: Aent, ..._cmps: TInstances) => {
            total++;
        });
        return total;
    }
}
