# Acmp

Atomic execution component primitive for Atoolkit.

Isolated execution unit receiving a mutable context (`ctx`) and optional diagnostic collector (`diag`), returning an optional typed result (`TRet`, defaults to `void`).

---

## Architecture

- **Execution Contract**: `exec(ctx, diag): TRet` mutating `ctx` directly or returning typed values.
- **Diagnostics**: Reports errors, warnings, and telemetry through `diag`.
- **Composability**: Invocable directly, stored in arbitrary structures, or composed by orchestrators.

---

## API Reference

### `Acmp<TCtx = unknown, TRet = void>`
Base class for executable components.

```ts
import { Acmp } from "Atoolkit/acmp";
import type { Adiag } from "Atoolkit/adiag";

// 1. Context mutation / command recording (TRet defaults to void)
export class DrawMesh extends Acmp<RenderCtx> {
    override exec(ctx: RenderCtx, diag?: Adiag): void {
        ctx.draw();
    }
}

// 2. Custom return value
export class RaycastQuery extends Acmp<PhysicsCtx, HitResult | null> {
    override exec(ctx: PhysicsCtx): HitResult | null {
        return ctx.raycast(this.origin, this.dir);
    }
}
```

### `acmp(fn)`
Constructs `Acmp` instance from inline function. Infers `TRet` automatically:

```ts
import { acmp } from "Atoolkit/acmp";

const computeBounds = acmp((ctx: MeshCtx) => {
    return ctx.computeBoundingBox();
});
const bounds = computeBounds.exec(meshCtx); // Typed as BoundingBox
```

---

## Error Handling & Diagnostics

Components do not return control flow signals or throw unhandled exceptions. Records error on `diag` upon failure:

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
