# Aecs

Lightweight, allocation-free Entity Component System built on `Acmp`. Stores entity states across sparse sets and provides O(1) component lookups and signature queries.

---

## Architecture

1. **Entity Primitive (`Aent`)**: 32-bit packed integer (20 bits index, 12 bits generation) with zero object allocations, direct array indexing, and automatic tombstoning against stale references.
2. **Component Storage (`SparseSet`)**: Contiguous dense component arrays mapped through sparse index tables, guaranteeing O(1) `set`, `get`, `has`, and swap-and-pop `remove`.
3. **Query Engine (`Aquery`)**: Traverses matching entities using smallest component sets as driver loops, evaluating secondary criteria in O(1) time.
4. **Execution Agnostic**: Components subclass `Acmp`, supporting pure data storage and optional `exec(ctx, diag)` execution.

---

## Entity Representation

`Aent` bit layout (32-bit integer):

```
[ 12 bits Generation (0..4095) ] [ 20 bits Slot Index (0..1,048,575) ]
```

Destroying an entity via `kill()` pushes its slot index to a recycling stack and increments its generation counter. Stale handles fail generation checks on access.

```ts
import { aentIndex, aentGen } from "./Aent.js";

const idx = aentIndex(entity); // extracts slot index
const gen = aentGen(entity);   // extracts recycling generation
```

---

## Storage Model

Each registered component type maintains an internal `SparseSet`:

- `dense: T[]`: Contiguous array of component instances. Keeps data packed without holes for cache-friendly iteration.
- `entities: Aent[]`: Array of entity identifiers tracking which entity owns each dense index.
- `sparse: number[]`: Direct lookup array mapping `entityIndex` to `denseIndex`.

Removing a component swaps the final dense element into the target slot and pops the array, maintaining contiguous layouts in O(1) time.

---

## API

### Lifecycle

- `spawn(...components: Acmp[]): Aent`: Allocates entity, attaches initial components, and returns identifier.
- `kill(entity: Aent): boolean`: Destroys entity, purges components, and recycles slot.
- `isAlive(entity: Aent): boolean`: Checks whether entity matches current slot generation.
- `count(): number`: Returns total count of active entities.
- `entities(): Aent[]`: Returns array of active entity identifiers.
- `clear(): void`: Clears all entities and resets component stores.

### Component Operations

- `set<T extends Acmp>(entity: Aent, component: T, cmpClass?: AcmpClass<T>): this`: Attaches or updates component instance.
- `setAll(entity: Aent, ...components: Acmp[]): this`: Batch attaches multiple components.
- `get<T extends Acmp>(entity: Aent, cmpClass: AcmpClass<T>): T | null`: Retrieves component instance.
- `has(entity: Aent, cmpClass: AcmpClass<any>): boolean`: Checks whether entity contains component.
- `remove(entity: Aent, cmpClass: AcmpClass<any>): boolean`: Removes component.
- `removeAll(entity: Aent, ...cmpClasses: AcmpClass[]): this`: Batch removes component types.
- `clearComponents(entity: Aent): this`: Removes all components while leaving entity alive.
- `getComponents(entity: Aent): Acmp[]`: Returns attached components for entity.

### Queries

- `query(...cmpClasses: AcmpClass[]): Aquery`: Creates iterator over entities matching component signature.
  - `.with(...cmpClasses)`: Requires components without yielding them in the tuple. Acts as loop driver if smaller than required stores.
  - `.without(...cmpClasses)`: Excludes entities containing specified components in O(1) time.
  - `.some(...cmpClasses)`: Requires at least one matching component from list.
  - `.entities(): Aent[]`: Returns matching entity IDs.
  - `.first(): [Aent, ...TInstances] | null`: Returns first matching result.
  - `.count(): number`: Returns total count of matching entities.
  - `.forEach((entity, ...cmps) => void)`: Iterates matching entities via callback.

### Component Execution

- `execEntity<TCtx, TRet>(entity: Aent, ctx: TCtx, diag?: Adiag): TRet[]`: Calls `cmp.exec(ctx, diag)` on attached components in sequence.

---

## Examples

### Dynamic Composition

```ts
import { Aecs } from "../aecs/index.js";
import { Acmp } from "../acmp/index.js";

class Position extends Acmp {
    x: number;
    y: number;
    constructor(x = 0, y = 0) { super(); this.x = x; this.y = y; }
}

class Velocity extends Acmp {
    vx: number;
    vy: number;
    constructor(vx = 0, vy = 0) { super(); this.vx = vx; this.vy = vy; }
}

class FrozenTag extends Acmp {}

const ecs = new Aecs();

const player = ecs.spawn(new Position(0, 0), new Velocity(2, 5));
const obstacle = ecs.spawn(new Position(10, 10));

// Iterate entities with Position and Velocity, ignoring frozen items
for (const [entity, pos, vel] of ecs.query(Position, Velocity).without(FrozenTag)) {
    pos.x += vel.vx;
    pos.y += vel.vy;
}
```

### Document / Canvas Element Model

```ts
class Bounds extends Acmp {
    x = 0;
    y = 0;
    w = 100;
    h = 100;
}

class Selectable extends Acmp {}
class Draggable extends Acmp {}
class Dirty extends Acmp {}

const ecs = new Aecs();
const box = ecs.spawn(new Bounds(), new Selectable(), new Draggable());

// User locks the element: simply drop Draggable
ecs.remove(box, Draggable);

// Drag processor only operates on elements retaining Draggable
for (const [id, bounds] of ecs.query(Bounds, Draggable)) {
    // Process movement
}
```
