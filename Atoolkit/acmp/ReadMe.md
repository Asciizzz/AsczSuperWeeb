# Acmp

Atomic execution component primitive for Atoolkit.

Isolated execution unit receiving a mutable context (`ctx`) and optional diagnostic collector (`diag`), returning an optional typed result (`TRet`, defaults to `void`).

---

## Architecture

- **Execution Contract**: `exec(ctx, diag): TRet` mutating `ctx` directly or returning typed values.
- **Diagnostics**: Reports errors, warnings, and telemetry through `diag`.
- **Composability**: Invocable directly, stored in arbitrary structures, or composed by orchestrators.

---

## API

### `Acmp<TCtx = unknown, TRet = void>`
Base class for executable components:

```ts
export class Acmp<TCtx = unknown, TRet = void> {
    abstract exec(ctx: TCtx, diag?: Adiag): TRet;
}
```

- **`ctx`**: Mutable execution context passed directly to the component.
- **`diag`**: Optional diagnostic collector for reporting errors and telemetry.
- **`TRet`**: Typed return value (defaults to `void`). Used when queries or calculations return data directly rather than mutating `ctx`.

```ts
import { Acmp } from "Atoolkit/acmp";
import type { Adiag } from "Atoolkit/adiag";

export class ProcessBuffer extends Acmp<BufferContext> {
    override exec(ctx: BufferContext, diag?: Adiag): void {
        ctx.flush();
    }
}
```

### `acmp(fn)`
Constructs `Acmp` instance from an inline function, inferring `TRet` automatically:

```ts
import { acmp } from "Atoolkit/acmp";

const computeBounds = acmp((ctx: MeshCtx) => {
    return ctx.computeBoundingBox();
});
const bounds = computeBounds.exec(meshCtx); // Typed as BoundingBox
```

---

## Diagnostics

Components do not return control flow signals or throw unhandled exceptions. Records errors on `diag` on failure:

```ts
override exec(ctx: MyCtx, diag?: Adiag): void {
    if (!this.resource) {
        diag?.err({
            code: "RESOURCE_MISSING",
            raw: "Required resource handle is null",
            data: { resourceId: this.resourceId }
        });
        return;
    }
    ctx.use(this.resource);
}
```
