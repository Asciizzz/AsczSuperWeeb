import type { Entity } from "./Entity.js";
import type { ComponentSet } from "./ComponentSet.js";

/**
 * Iterates through entities belonging to both set A and set B.
 * Automatically drives from the smaller set for minimal loop iterations.
 */
export function join2<A, B>(
    setA: ComponentSet<A>,
    setB: ComponentSet<B>,
    fn: (entity: Entity, a: A, b: B) => void
): void {
    if (setA.size === 0 || setB.size === 0) return;

    if (setA.size <= setB.size) {
        const len = setA.dense.length;
        for (let i = 0; i < len; i++) {
            const entity = setA.entities[i];
            const b = setB.get(entity);
            if (b !== undefined) {
                fn(entity, setA.dense[i], b);
            }
        }
    } else {
        const len = setB.dense.length;
        for (let i = 0; i < len; i++) {
            const entity = setB.entities[i];
            const a = setA.get(entity);
            if (a !== undefined) {
                fn(entity, a, setB.dense[i]);
            }
        }
    }
}

/**
 * Iterates through entities belonging to three component sets.
 */
export function join3<A, B, C>(
    setA: ComponentSet<A>,
    setB: ComponentSet<B>,
    setC: ComponentSet<C>,
    fn: (entity: Entity, a: A, b: B, c: C) => void
): void {
    if (setA.size === 0 || setB.size === 0 || setC.size === 0) return;

    // Determine driver with smallest size
    if (setA.size <= setB.size && setA.size <= setC.size) {
        const len = setA.dense.length;
        for (let i = 0; i < len; i++) {
            const ent = setA.entities[i];
            const b = setB.get(ent);
            if (b === undefined) continue;
            const c = setC.get(ent);
            if (c === undefined) continue;
            fn(ent, setA.dense[i], b, c);
        }
    } else if (setB.size <= setA.size && setB.size <= setC.size) {
        const len = setB.dense.length;
        for (let i = 0; i < len; i++) {
            const ent = setB.entities[i];
            const a = setA.get(ent);
            if (a === undefined) continue;
            const c = setC.get(ent);
            if (c === undefined) continue;
            fn(ent, a, setB.dense[i], c);
        }
    } else {
        const len = setC.dense.length;
        for (let i = 0; i < len; i++) {
            const ent = setC.entities[i];
            const a = setA.get(ent);
            if (a === undefined) continue;
            const b = setB.get(ent);
            if (b === undefined) continue;
            fn(ent, a, b, setC.dense[i]);
        }
    }
}
