# Adiag

Structured diagnostic collector and causal error bus for Atoolkit.

---

## Key Behaviors

1. **Typed Records**: Objects with `type` ('ok', 'err', 'warn', 'info'), `code`, `raw`, `data`, and optional `ref` pointer.
2. **Causal Reference Chaining (`ref`)**: High-level failures point directly to low-level causes. `Adiag.getCauseChain` walks pointer chains safely using visited sets to avoid circular references.
3. **Bounded Log History**: Caps history at 1,000 entries, shifting oldest items out automatically to prevent frame-loop memory leaks.
4. **Message Interpolation**: Compiles `$key$` and `$key.subkey$` placeholders from `data` via `Adiag.compileMsg`.

---

## Usage

```ts
import { Adiag } from "../adiag/index.js";

const diag = new Adiag();

// 1. Log basic diagnostics
diag.ok({ code: "PIPELINE_INIT_OK" });
diag.warn({
    code: "FALLBACK_FORMAT",
    raw: "Using fallback texture format: $format$",
    data: { format: "rgba8unorm" },
});

// 2. Chain causal errors across subsystems
const underlyingErr = diag.err({
    code: "RESOURCE_MISSING",
    raw: "Resource '$path$' not found",
    data: { path: "assets/mesh.bin" },
});

const taskErr = diag.err({
    code: "STAGE_FAILED",
    raw: "Could not initialize stage '$stage$'",
    data: { stage: "geometry" },
    ref: underlyingErr, // Points to root cause
});

// 3. Print causal trace
console.log(Adiag.resultToChainMsg(taskErr));
// Output:
// Could not initialize stage 'geometry'
//   -> Caused by: Resource 'assets/mesh.bin' not found

// 4. Query helpers
console.log(diag.hasErrs());  // true
console.log(diag.findErrs()); // [underlyingErr, taskErr]
```

---

## API

```ts
export interface AdiagResult {
    type: string;
    code: string;
    raw: string;
    data: unknown;
    ref?: AdiagResult | null;
}
```

* **`ref`**: Causal reference pointer linking a high-level failure directly to its low-level cause.
* **`raw`**: Message template containing `$key$` and `$key.subkey$` placeholders interpolated from `data`.

```ts
export class Adiag {
    results: AdiagResult[];
    state: Record<string, unknown>;

    ok(args?: AdiagAddArgs): AdiagResult;
    err(args?: AdiagAddArgs): AdiagResult;
    warn(args?: AdiagAddArgs): AdiagResult;
    info(args?: AdiagAddArgs): AdiagResult;

    last(): AdiagResult | null;
    lastErr(): AdiagResult | null;
    allOk(): boolean;
    clear(): void;

    static getCauseChain(result: AdiagResult | null | undefined): AdiagResult[];
    static compileMsg(raw?: string, data?: Record<string, unknown>): string;
    static resultToMsg(result: AdiagResult): string;
    static resultToChainMsg(result: AdiagResult): string;
}
```

* **`results`**: Log history capped at 1,000 entries; shifts oldest items out automatically.
* **`lastErr()`**: Scans backward from newest entries for the most recent error record.
* **`getCauseChain(result)`**: Traverses `ref` pointers into an array ordered from high-level failure to root cause, using a visited set to prevent cycles.
* **`compileMsg(raw, data)`**: Interpolates `$key$` and nested `$key.subkey$` placeholders against `data` values.
* **`resultToChainMsg(result)`**: Formats the complete causal chain into an indented multi-line diagnostic trace.
