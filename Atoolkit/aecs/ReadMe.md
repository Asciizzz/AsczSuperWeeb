# aecs_new

Minimalist, sets-first Entity Component System. Eliminates coordinator god classes and treats components as standalone sets.

## Architecture

- **`Entity`**: Plain numeric identifier (`type Entity = number`).
- **`EntityPool`**: Simple recycling pool that hands out numbers and reuses deleted IDs.
- **`ComponentSet<T>`**: Contiguous sparse-dense storage for JavaScript objects or tags.
- **`FloatSet`**: Contiguous `Float32Array` storage for high-frequency numeric data.
- **`join2`, `join3`**: Direct set intersection functions that drive from the smallest set.

## API

### EntityPool

```ts
import { EntityPool } from "./Entity.js";

const pool = new EntityPool();
const entity = pool.spawn(); // returns 1
pool.destroy(entity);        // recycles 1
```

### ComponentSet

```ts
import { ComponentSet } from "./ComponentSet.js";

const names = new ComponentSet<{ label: string }>();

names.set(entity, { label: "Hero" });
names.has(entity);       // true
names.get(entity);       // { label: "Hero" }
names.delete(entity);    // true
```

Iterating a set directly:

```ts
for (const [entity, name] of names) {
    console.log(entity, name.label);
}
```

### FloatSet

```ts
import { FloatSet } from "./FloatSet.js";

// Stride of 2 floats: [posX, posY]
const positions = new FloatSet(2);

positions.set(entity, [100, 200]);
const pos = positions.get(entity); // Float32Array slice
pos[0] += 5; // updates x in place
```

### Joining Sets

To process entities possessing multiple components, intersect the sets directly:

```ts
import { join2 } from "./join.js";

join2(names, positions, (entity, name, pos) => {
    console.log(`Entity ${name.label} at (${pos[0]}, ${pos[1]})`);
});
```
