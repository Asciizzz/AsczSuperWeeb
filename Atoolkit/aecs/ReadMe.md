# Aecs

Lightweight, allocation-free Entity Component System for persistent component data. Stores entity state across sparse sets and provides O(1) component lookups and signature queries.

---

## Architecture

1. **Entity Primitive (`Aent`)**: 32-bit packed integer (20 bits index, 12 bits generation) with zero object allocations, direct array indexing, and automatic tombstoning against stale references.
2. **Component Storage (`SparseSet`)**: Contiguous dense component arrays mapped through sparse index tables, guaranteeing O(1) `set`, `get`, `has`, and swap-and-pop `remove`.
3. **Query Engine (`Aquery`)**: Traverses matching entities using smallest component sets as driver loops, evaluating secondary criteria in O(1) time.
4. **Execution Agnostic**: Components are plain data objects. External systems decide how to process queried entities.

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

```ts
export class Aecs {
    constructor(options?: AecsOptions);

    spawn(...components: object[]): Aent;
    kill(entity: Aent): boolean;
    isAlive(entity: Aent): boolean;
    count(): number;
    allEntities(): Aent[];
    clear(): void;

    set<T extends object>(entity: Aent, component: T, cmpClass?: ComponentClass<T>): this;
    setAll(entity: Aent, ...components: object[]): this;
    get<T extends object>(entity: Aent, cmpClass: ComponentClass<T>): T | null;
    has(entity: Aent, cmpClass: ComponentClass): boolean;
    remove(entity: Aent, cmpClass: ComponentClass): boolean;
    removeAll(entity: Aent, ...cmpClasses: ComponentClass[]): this;
    clearComponents(entity: Aent): this;
    getComponents(entity: Aent): object[];

    query<const T extends readonly ComponentClass[]>(...cmpClasses: T): Aquery<InferComponentInstances<T>>;
}
```

- **`spawn(...components)`**: Allocates a packed 32-bit entity identifier (`Aent`), reusing recycled slot indices before expanding capacity.
- **`kill(entity)`**: Purges all attached components from sparse sets, increments slot generation counter, and pushes index to the recycling pool.
- **`isAlive(entity)`**: O(1) generational validation comparing the identifier's generation against current slot state.
- **`clearComponents(entity)`**: Removes all attached components from sparse sets while preserving entity identity and lifecycle state.

```ts
export class Aquery<TInstances extends readonly object[] = object[]> implements Iterable<[Aent, ...TInstances]> {
    with(...types: ComponentClass[]): this;
    without(...types: ComponentClass[]): this;
    some(...types: ComponentClass[]): this;

    first(): [Aent, ...TInstances] | null;
    entities(): Aent[];
    count(): number;
    forEach(fn: (entity: Aent, ...components: TInstances) => void): void;
}
```

- **`[Symbol.iterator]`**: Uses the smallest sparse set among required and `.with` types to drive the iteration loop, evaluating secondary criteria in O(1) time.
- **`.with(...types)`**: Requires component presence without yielding instances in the result tuple. Serves as driver loop if smaller than required stores.
- **`.without(...types)`**: O(1) exclusion filter skipping entities holding any specified component types.
- **`.some(...types)`**: Requires presence of at least one component from the set.

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
