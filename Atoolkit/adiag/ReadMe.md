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

### Instance Methods

- `ok(args)`: Records 'ok' item, returning `AdiagResult`.
- `err(args)`: Records 'err' item, returning `AdiagResult`.
- `warn(args)`: Records 'warn' item, returning `AdiagResult`.
- `info(args)`: Records 'info' item, returning `AdiagResult`.
- `last()`: Returns latest entry or null.
- `lastErr()`: Scans backward for most recent 'err' entry, returning it or null.
- `clear()`: Empties results array.
- `hasErrs()` / `findErrs()`: Checks existence of or filters 'err' entries.
- `hasWarns()` / `findWarns()`: Checks existence of or filters 'warn' entries.
- `hasInfos()` / `findInfos()`: Checks existence of or filters 'info' entries.
- `allOk()`: Returns true if every recorded item is 'ok'.

### Static Helpers

- `Adiag.getCauseChain(result)`: Follows `result.ref` pointers into array `[result, result.ref, ...]`.
- `Adiag.compileMsg(raw, data)`: Replaces `$key$` and `$key.subkey$` patterns with values from `data`.
- `Adiag.resultToMsg(result)`: Compiles interpolated string for single result.
- `Adiag.resultToChainMsg(result)`: Formats causal chain into indented multi-line string.
