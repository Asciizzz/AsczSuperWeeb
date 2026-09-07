/**
 * Aent: Entity identifier primitive for Aecs.
 *
 * An entity is represented by a packed 32-bit integer:
 * - Bits 0-19 (20 bits): Index within registry (supports up to 1,048,575 concurrent entities).
 * - Bits 20-31 (12 bits): Generation counter (supports up to 4,095 recycling cycles before wrap-around).
 *
 * Small integers avoid heap allocations and enable direct array indexing.
 */
export type Aent = number;

export const AENT_INDEX_BITS = 20;
export const AENT_INDEX_MASK = (1 << AENT_INDEX_BITS) - 1; // 0xFFFFF = 1,048,575
export const AENT_GEN_BITS = 12;
export const AENT_GEN_MASK = (1 << AENT_GEN_BITS) - 1;   // 0xFFF = 4,095
export const AENT_NULL: Aent = -1;

/**
 * Extracts the 20-bit registry slot index from an entity identifier.
 */
export function aentIndex(entity: Aent): number {
    return entity & AENT_INDEX_MASK;
}

/**
 * Extracts the 12-bit generation count from an entity identifier.
 */
export function aentGen(entity: Aent): number {
    return (entity >>> AENT_INDEX_BITS) & AENT_GEN_MASK;
}

/**
 * Packs an index and generation count into an Aent identifier.
 */
export function aent(index: number, gen: number = 0): Aent {
    return ((gen & AENT_GEN_MASK) << AENT_INDEX_BITS) | (index & AENT_INDEX_MASK);
}

/**
 * Returns a human-readable representation of an entity identifier.
 */
export function aentToString(entity: Aent): string {
    if (entity === AENT_NULL || entity < 0) return "Aent(null)";
    return `Aent(${aentIndex(entity)}:v${aentGen(entity)})`;
}
