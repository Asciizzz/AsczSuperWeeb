# Aecs

Minimalist, sets-first Entity Component System. Eliminates coordinator god classes, treating components as self-contained sparse-dense sets indexed by entity numbers.

---

## Architecture Overview

Aecs structures entity data across five primitives:

1. `Entity`: Numeric identifier (`type Entity = number`).
2. `EntityPool`: Slot allocator managing issuance and recycled slot reuse.
3. `ComponentSet<T>`: Contiguous sparse-dense storage for JavaScript objects and tags.
4. `FloatSet`: Contiguous packed `Float32Array` storage for high-frequency numeric vectors and matrices.
5. `join2` & `join3`: Direct set intersection functions driven from the smallest set.

---

## 1. Entity Identifier Allocation

`EntityPool` allocates numeric IDs and reclaims destroyed IDs via an internal free-list array.

```typescript
import { EntityPool } from "./Entity.js";

const pool = new EntityPool();

// Allocates incremental entity ID (starts at 1)
const e1 = pool.spawn(); // 1
const e2 = pool.spawn(); // 2

// Recycles destroyed ID
pool.destroy(e1);
const e3 = pool.spawn(); // 1 (recycled from free list)
```

- `spawn()`: Returns the most recently freed identifier from the internal free list if available; increments internal counter otherwise. Zero allocations occur during recycled ID reuse.
- `destroy(entity)`: Pushes identifier onto free-list array for subsequent reuse.
- `clear()`: Resets identifier counter to 1 and empties free-list array.

---

## 2. Object and Tag Storage

`ComponentSet<T>` implements a contiguous sparse-dense set for arbitrary JavaScript objects, references, or state tags.

```typescript
import { ComponentSet } from "./ComponentSet.js";

interface Transform {
    x: number;
    y: number;
}

const transforms = new ComponentSet<Transform>();

// Mutations
transforms.set(e1, { x: 10, y: 20 });
const hasTransform = transforms.has(e1); // true
const t = transforms.get(e1);           // { x: 10, y: 20 }

// Deletion via swap-and-pop
transforms.delete(e1);

// Dense contiguous iteration
for (const [entity, transform] of transforms) {
    console.log(entity, transform.x, transform.y);
}

transforms.each((entity, transform) => {
    transform.x += 1;
});
```

- Storage layout:
  - `dense: T[]`: Packed array storing component values contiguously with zero holes.
  - `entities: Entity[]`: Packed array storing corresponding entity IDs at matching dense indices.
  - `sparse: number[]`: Direct lookup array mapping entity IDs to indices in `dense`.
- `set(entity, value)`: Updates value in place if entity already exists in set. Otherwise, appends value and entity ID to dense arrays and records new index in sparse array in O(1).
- `delete(entity)`: Swaps the tail element into the deleted element's dense slot, pops the tail, updates the swapped element's sparse pointer, and sets the deleted entity's sparse pointer to `-1` in O(1). Preserves contiguous dense array packing.
- `get(entity)`: Verifies sparse index bounds and entity identity, returning component reference in O(1) without hash lookups.
- `has(entity)`: Returns boolean indicating whether entity is present in set.
- Direct traversal: `Symbol.iterator` and `each(fn)` iterate dense arrays sequentially, maximizing CPU cache coherence and bypassing sparse array lookups entirely.

---

## 3. Packed Numeric Storage

`FloatSet` provides flat `Float32Array` storage for high-frequency numeric components (positions, velocities, colors, matrices).

```typescript
import { FloatSet } from "./FloatSet.js";

// Stride of 3 floats: [x, y, z]
const positions = new FloatSet(3, 1024);

// Write coordinates directly
positions.set(e1, [100.0, 200.0, 300.0]);

// Zero-allocation slice retrieval
const pos = positions.get(e1); // Float32Array(3) subarray view
if (pos) {
    pos[0] += 5.0; // In-place coordinate update
}

// Contiguous iteration
positions.each((entity, coords) => {
    coords[1] -= 9.8; // Gravity step
});
```

- Storage layout: Flat `dense: Float32Array` storing interleaved numeric records of length `stride`, paired with `entities: Entity[]` and `sparse: number[]`.
- `stride`: Fixed number of float elements per entity (e.g. 2 for 2D vectors, 3 for 3D coordinates, 16 for 4x4 transform matrices).
- Buffer expansion: Automatically doubles backing `Float32Array` capacity when element count exceeds allocated bounds, copying existing data in a single typed array copy.
- `get(entity)`: Returns a `Float32Array.subarray` view into dense memory in O(1). Operates with zero heap allocations.
- `set(entity, values)`: Writes numeric values directly into dense memory slice. If entity is already registered, mutates existing slice in place; otherwise appends to dense buffer and updates sparse lookup.
- `delete(entity)`: Uses `Float32Array.copyWithin` to swap the tail stride block into the vacated slot, decrementing size and updating sparse pointers in O(1).
- `each(fn)`: Loops sequentially through packed float buffer, invoking callback with entity ID and `subarray` view for every registered slot.

---

## 4. Set Intersection Joins

`join2` and `join3` perform direct set intersections across multiple component sets, evaluating cardinality to drive iteration from the smallest set.

```typescript
import { ComponentSet, FloatSet, join2, join3 } from "./index.js";

const tags = new ComponentSet<{ active: boolean }>();
const velocities = new FloatSet(3);

// Iterating entities possessing both tags and positions
join2(tags, positions, (entity, tag, pos) => {
    if (tag.active) {
        pos[0] += 1.0;
    }
});

// Iterating entities possessing tags, positions, and velocities
join3(tags, positions, velocities, (entity, tag, pos, vel) => {
    pos[0] += vel[0];
    pos[1] += vel[1];
    pos[2] += vel[2];
});
```

- `join2(setA, setB, fn)`: Inspects `setA.size` and `setB.size`. Iterates the dense array of whichever set has fewer elements, querying the companion set via O(1) sparse lookup. Minimizes total loop iterations.
- `join3(setA, setB, setC, fn)`: Compares cardinality across three sets. Drives execution loop from the set with lowest element count, performing O(1) lookups against the remaining two sets.
- Early exit: Aborts immediately with zero iterations when any participating set has a size of 0.
