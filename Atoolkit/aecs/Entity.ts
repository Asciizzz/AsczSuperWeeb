export type Entity = number;

export const ENTITY_INDEX_BITS = 20;
export const ENTITY_INDEX_MASK = 0xFFFFF; // 1,048,575 slots
export const ENTITY_GEN_BITS = 12;
export const ENTITY_GEN_MASK = 0xFFF;     // 4,095 generations

/** Extracts slot index from entity identifier. */
export function entityIndex(entity: Entity): number {
    return (entity & ENTITY_INDEX_MASK) >>> 0;
}

/** Extracts generation counter from entity identifier. */
export function entityGeneration(entity: Entity): number {
    return ((entity >>> ENTITY_INDEX_BITS) & ENTITY_GEN_MASK) >>> 0;
}

/** Composes an entity identifier from slot index and generation. */
export function makeEntity(index: number, generation: number): Entity {
    return ((((generation & ENTITY_GEN_MASK) << ENTITY_INDEX_BITS) | (index & ENTITY_INDEX_MASK)) >>> 0);
}

/**
 * Generational entity identifier allocator.
 */
export class EntityPool {
    private _nextIndex = 1;
    private readonly _generations: number[] = [0];
    private readonly _free: number[] = [];

    /** Total currently active living entities. */
    get aliveCount(): number {
        return (this._nextIndex - 1) - this._free.length;
    }

    /** Total entity slots allocated since creation. */
    get totalAllocated(): number {
        return this._nextIndex - 1;
    }

    /**
     * Allocates an entity identifier.
     * Reuses recycled slot indices with incremented generation if available.
     */
    spawn(): Entity {
        if (this._free.length > 0) {
            const index = this._free.pop()!;
            const gen = this._generations[index];
            return makeEntity(index, gen);
        }

        const index = this._nextIndex++;
        this._generations[index] = 1;
        return makeEntity(index, 1);
    }

    /**
     * Destroys an entity and reclaims its slot for reuse.
     * Increments slot generation to invalidate outstanding references.
     * Returns false if entity is already destroyed or invalid.
     */
    destroy(entity: Entity): boolean {
        const index = entityIndex(entity);
        const gen = entityGeneration(entity);

        if (index <= 0 || index >= this._nextIndex || this._generations[index] !== gen) {
            return false;
        }

        let nextGen = (gen + 1) & ENTITY_GEN_MASK;
        if (nextGen === 0) nextGen = 1;
        this._generations[index] = nextGen;
        this._free.push(index);
        return true;
    }

    /**
     * Verifies whether entity identifier is currently allocated and matches active generation.
     */
    isAlive(entity: Entity): boolean {
        const index = entityIndex(entity);
        const gen = entityGeneration(entity);
        return index > 0 && index < this._nextIndex && this._generations[index] === gen;
    }

    /**
     * Resets pool to initial state, invalidating all issued entities.
     */
    clear(): void {
        this._nextIndex = 1;
        this._free.length = 0;
        this._generations.length = 1;
        this._generations[0] = 0;
    }
}
