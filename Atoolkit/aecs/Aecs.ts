/* Aecs
By Asciiz

Entity Component System built from Acmp.
Stores entities and their component payloads using Sparse Sets.
Queries entities by component signatures with O(1) lookups and zero allocations.

# Methods:

spawn(...components: Acmp[]): Aent
kill(entity: Aent): boolean
isAlive(entity: Aent): boolean

set(entity: Aent, component: Acmp, cmpClass?: AcmpClass): this
setAll(entity: Aent, ...components: Acmp[]): this
get(entity: Aent, cmpClass: AcmpClass): T | null
has(entity: Aent, cmpClass: AcmpClass): boolean
remove(entity: Aent, cmpClass: AcmpClass): boolean
removeAll(entity: Aent, ...cmpClasses: AcmpClass[]): this
clearComponents(entity: Aent): this
getComponents(entity: Aent): Acmp[]

query(...cmpClasses: AcmpClass[]): Aquery

execEntity(entity: Aent, ctx: TCtx, diag?: Adiag): TRet[]

entities(): Aent[]
count(): number
clear(): void
*/

import type { Adiag } from "../adiag/index.js";
import { Acmp } from "../acmp/index.js";
import { type Aent, aent, aentIndex, aentGen, AENT_GEN_MASK, AENT_NULL } from "./Aent.js";
import { SparseSet } from "./SparseSet.js";
import { Aquery, type AcmpClass, type InferAcmpInstances } from "./Aquery.js";

export interface AecsOptions {
    diag?: Adiag;
    label?: string;
    initialCapacity?: number;
}

/**
 * Entity Component System coordinator.
 *
 * Manages entity identifiers, sparse set component stores, and signature queries.
 */
export class Aecs {
    diag?: Adiag;
    label?: string;

    private readonly stores = new Map<AcmpClass, SparseSet>();
    private readonly entityComponents = new Map<number, Set<AcmpClass>>();
    private readonly freeIndices: number[] = [];
    private readonly generations: number[] = [];
    private isAllocated: Uint8Array;
    private nextIndex = 0;
    private aliveCount = 0;

    constructor(options: AecsOptions = {}) {
        this.diag = options.diag;
        this.label = options.label;
        const cap = options.initialCapacity ?? 256;
        this.isAllocated = new Uint8Array(cap);
    }

    /** Inspection view of registered component stores */
    get registeredStores(): ReadonlyMap<AcmpClass, SparseSet> {
        return this.stores;
    }

    /** Inspection view of slot recycling generation counts */
    get generationTable(): readonly number[] {
        return this.generations;
    }

    /** Inspection view of allocated entity slot flags */
    get allocatedTable(): Uint8Array {
        return this.isAllocated;
    }

    /** Inspection view of recycled slot index pool */
    get freeSlotPool(): readonly number[] {
        return this.freeIndices;
    }

    /** Inspection view of highest allocated slot index count */
    get highWaterIndex(): number {
        return this.nextIndex;
    }

    #ensureCapacity(index: number): void {
        if (index >= this.isAllocated.length) {
            const nextCap = Math.max(index + 1, this.isAllocated.length * 2);
            const nextAllocated = new Uint8Array(nextCap);
            nextAllocated.set(this.isAllocated);
            this.isAllocated = nextAllocated;
        }
    }

    /**
     * Creates a new living entity, optionally attaching initial components.
     */
    spawn(...components: Acmp[]): Aent {
        let index: number;
        if (this.freeIndices.length > 0) {
            index = this.freeIndices.pop()!;
        } else {
            index = this.nextIndex++;
            this.#ensureCapacity(index);
            this.generations[index] = 0;
        }

        const gen = this.generations[index];
        this.isAllocated[index] = 1;
        this.aliveCount++;

        const entity = aent(index, gen);

        if (components.length > 0) {
            this.setAll(entity, ...components);
        }

        this.diag?.ok({ code: "ENTITY_SPAWNED", raw: 'Spawned entity $entity$', data: { entity } });
        return entity;
    }

    /**
     * Checks whether an entity identifier refers to an active, non-recycled entity.
     */
    isAlive(entity: Aent): boolean {
        if (entity === AENT_NULL || entity < 0) return false;
        const idx = aentIndex(entity);
        const gen = aentGen(entity);
        return idx < this.nextIndex && this.isAllocated[idx] === 1 && this.generations[idx] === gen;
    }

    /**
     * Destroys an entity, cleans up all attached components, and recycles its slot.
     */
    kill(entity: Aent): boolean {
        if (!this.isAlive(entity)) {
            this.diag?.warn({ code: "ENTITY_NOT_FOUND", raw: 'Cannot kill entity $entity$: not alive', data: { entity } });
            return false;
        }

        const idx = aentIndex(entity);
        const compTypes = this.entityComponents.get(idx);
        if (compTypes) {
            for (const cmpClass of compTypes) {
                const store = this.stores.get(cmpClass);
                if (store) store.remove(entity);
            }
            compTypes.clear();
        }

        this.isAllocated[idx] = 0;
        this.generations[idx] = (this.generations[idx] + 1) & AENT_GEN_MASK;
        this.freeIndices.push(idx);
        this.aliveCount--;

        this.diag?.ok({ code: "ENTITY_KILLED", raw: 'Killed entity $entity$', data: { entity } });
        return true;
    }

    /**
     * Attaches or updates a component instance on an entity.
     */
    set<T extends Acmp>(entity: Aent, component: T, cmpClass?: AcmpClass<T>): this {
        if (!this.isAlive(entity)) {
            this.diag?.err({ code: "ENTITY_DEAD", raw: 'Cannot set component on dead entity $entity$', data: { entity } });
            return this;
        }

        const cls = (cmpClass ?? (component.constructor as AcmpClass<T>)) as AcmpClass;
        let store = this.stores.get(cls);
        if (!store) {
            store = new SparseSet();
            this.stores.set(cls, store);
        }

        store.set(entity, component);

        const idx = aentIndex(entity);
        let compTypes = this.entityComponents.get(idx);
        if (!compTypes) {
            compTypes = new Set();
            this.entityComponents.set(idx, compTypes);
        }
        compTypes.add(cls);

        return this;
    }

    /**
     * Attaches multiple components to an entity in a single call.
     */
    setAll(entity: Aent, ...components: Acmp[]): this {
        for (let i = 0; i < components.length; i++) {
            this.set(entity, components[i]);
        }
        return this;
    }

    /**
     * Retrieves the component instance of the specified type attached to an entity.
     */
    get<T extends Acmp>(entity: Aent, cmpClass: AcmpClass<T>): T | null {
        if (!this.isAlive(entity)) return null;
        const store = this.stores.get(cmpClass as AcmpClass);
        if (!store) return null;
        return store.get(entity) as T | null;
    }

    /**
     * Checks whether an entity currently holds a component of the specified type.
     */
    has(entity: Aent, cmpClass: AcmpClass<any>): boolean {
        if (!this.isAlive(entity)) return false;
        const store = this.stores.get(cmpClass as AcmpClass);
        return store ? store.has(entity) : false;
    }

    /**
     * Removes a component type from an entity.
     */
    remove(entity: Aent, cmpClass: AcmpClass<any>): boolean {
        if (!this.isAlive(entity)) return false;
        const store = this.stores.get(cmpClass as AcmpClass);
        if (!store) return false;

        const removed = store.remove(entity);
        if (removed) {
            const idx = aentIndex(entity);
            this.entityComponents.get(idx)?.delete(cmpClass as AcmpClass);
        }
        return removed;
    }

    /**
     * Removes multiple component types from an entity.
     */
    removeAll(entity: Aent, ...cmpClasses: AcmpClass[]): this {
        for (let i = 0; i < cmpClasses.length; i++) {
            this.remove(entity, cmpClasses[i]);
        }
        return this;
    }

    /**
     * Removes all components attached to an entity without destroying the entity.
     */
    clearComponents(entity: Aent): this {
        if (!this.isAlive(entity)) return this;
        const idx = aentIndex(entity);
        const compTypes = this.entityComponents.get(idx);
        if (compTypes) {
            for (const cmpClass of compTypes) {
                const store = this.stores.get(cmpClass);
                if (store) store.remove(entity);
            }
            compTypes.clear();
        }
        return this;
    }

    /**
     * Returns an array of all component instances currently attached to an entity.
     */
    getComponents(entity: Aent): Acmp[] {
        if (!this.isAlive(entity)) return [];
        const idx = aentIndex(entity);
        const compTypes = this.entityComponents.get(idx);
        if (!compTypes || compTypes.size === 0) return [];

        const list: Acmp[] = [];
        for (const cmpClass of compTypes) {
            const store = this.stores.get(cmpClass);
            if (store) {
                const cmp = store.get(entity);
                if (cmp) list.push(cmp);
            }
        }
        return list;
    }


    /**
     * Creates a query to filter entities possessing the specified component types.
     */
    query<const T extends readonly AcmpClass[]>(...cmpClasses: T): Aquery<InferAcmpInstances<T>> {
        return new Aquery<InferAcmpInstances<T>>(this, cmpClasses as unknown as AcmpClass[]);
    }

    /**
     * Internal access to a component type's SparseSet.
     */
    getStore<T extends Acmp = Acmp>(cmpClass: AcmpClass<T>): SparseSet<T> | undefined {
        return this.stores.get(cmpClass as AcmpClass) as SparseSet<T> | undefined;
    }

    /**
     * Returns an array of all currently living entities.
     */
    allEntities(): Aent[] {
        const result: Aent[] = [];
        for (let idx = 0; idx < this.nextIndex; idx++) {
            if (this.isAllocated[idx] === 1) {
                result.push(aent(idx, this.generations[idx]));
            }
        }
        return result;
    }

    /**
     * Alias for allEntities().
     */
    entities(): Aent[] {
        return this.allEntities();
    }

    /**
     * Returns the total number of living entities.
     */
    count(): number {
        return this.aliveCount;
    }

    /**
     * Executes all Acmp components attached to an entity in sequence.
     */
    execEntity<TCtx = unknown, TRet = void>(entity: Aent, ctx: TCtx, diag?: Adiag): TRet[] {
        if (!this.isAlive(entity)) return [];
        const activeDiag = diag ?? this.diag;
        const components = this.getComponents(entity);
        const results: TRet[] = [];
        for (let i = 0; i < components.length; i++) {
            const cmp = components[i] as Acmp<TCtx, TRet>;
            results.push(cmp.exec(ctx, activeDiag));
        }
        return results;
    }

    /**
     * Clears all entities, resets component stores, and empties recycling pools.
     */
    clear(): void {
        for (const store of this.stores.values()) {
            store.clear();
        }
        this.entityComponents.clear();
        this.freeIndices.length = 0;
        this.isAllocated.fill(0);
        this.generations.length = 0;
        this.nextIndex = 0;
        this.aliveCount = 0;
        this.diag?.ok({ code: "ECS_CLEARED", raw: 'Cleared all entities and component stores' });
    }
}
