// ==================== Types =====================

export interface AdiagResult {
    type: string;
    code: string;
    raw: string;
    data: unknown;
    ref?: AdiagResult | null; // Causal reference pointer to another diagnostic result
}

export interface AdiagAddArgs {
    code?: string;
    raw?: string;
    data?: unknown;
    ref?: AdiagResult | null;
}

// ==================== Adiag =====================

export class Adiag {
    results: AdiagResult[] = [];
    state: Record<string, unknown> = {}; // shared state for all diag

    static readonly TYPE_OK   = "ok";
    static readonly TYPE_ERR  = "err";
    static readonly TYPE_WARN = "warn";
    static readonly TYPE_INFO = "info";

    ok(args: AdiagAddArgs = {}):   AdiagResult { return this.#add(Adiag.TYPE_OK,   args); }
    err(args: AdiagAddArgs = {}):  AdiagResult { return this.#add(Adiag.TYPE_ERR,  args); }
    warn(args: AdiagAddArgs = {}): AdiagResult { return this.#add(Adiag.TYPE_WARN, args); }
    info(args: AdiagAddArgs = {}): AdiagResult { return this.#add(Adiag.TYPE_INFO, args); }

    #add(type: string, { code = "", raw = "", data = null, ref = null }: AdiagAddArgs = {}): AdiagResult {
        const item: AdiagResult = { type, code, raw, data, ref };
        this.results.push(item);

        // Cap maximum diagnostic log history
        if (this.results.length > 1000) {
            this.results.shift();
        }

        return item;
    }

    clear(): void { this.results = []; }

    last(): AdiagResult | null {
        return this.results[this.results.length - 1] ?? null;
    }

    lastErr(): AdiagResult | null {
        for (let i = this.results.length - 1; i >= 0; i--) {
            if (this.results[i].type === Adiag.TYPE_ERR) {
                return this.results[i];
            }
        }
        return null;
    }

    allOk():    boolean        { return this.results.every(r => r.type === Adiag.TYPE_OK); }
    findOk():   AdiagResult[]  { return this.results.filter(r => r.type === Adiag.TYPE_OK); }

    hasErrs():  boolean        { return this.results.some(r => r.type === Adiag.TYPE_ERR); }
    findErrs(): AdiagResult[]  { return this.results.filter(r => r.type === Adiag.TYPE_ERR); }

    hasWarns():  boolean       { return this.results.some(r => r.type === Adiag.TYPE_WARN); }
    findWarns(): AdiagResult[] { return this.results.filter(r => r.type === Adiag.TYPE_WARN); }

    hasInfos():  boolean       { return this.results.some(r => r.type === Adiag.TYPE_INFO); }
    findInfos(): AdiagResult[] { return this.results.filter(r => r.type === Adiag.TYPE_INFO); }

    /**
     * Extracts the causal reference chain starting from `result`.
     * E.g. [highLevelResult, causeResult, ...]
     */
    static getCauseChain(result: AdiagResult | null | undefined): AdiagResult[] {
        const chain: AdiagResult[] = [];
        let curr: AdiagResult | null | undefined = result;
        const seen = new Set<AdiagResult>();

        while (curr && !seen.has(curr)) {
            seen.add(curr);
            chain.push(curr);
            curr = curr.ref;
        }

        return chain;
    }

    /*
    Replace all $key$ with data[key] in the message.
    Support dot nesting: $key.subkey$ -> data.key.subkey
    */
    static compileMsg(raw = "", data: Record<string, unknown> = {}): string {
        if (typeof raw !== "string" || raw.length === 0) return raw;
        if (data == null || typeof data !== "object") return raw;

        return raw.replace(/\$([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\$/g, (match, path: string) => {
            if (data == null || typeof data !== "object") return match;

            let value: unknown = data;
            for (const key of path.split(".")) {
                if (value == null || typeof value !== "object" || !(key in value)) return match;
                value = (value as Record<string, unknown>)[key];
            }

            if (value instanceof Error)    return value.message;
            if (typeof value === "string") return value;
            if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
            if (value == null)             return String(value);
            if (typeof value === "function") return (value as Function).name ? `[Function ${(value as Function).name}]` : "[Function]";

            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        });
    }

    static resultToMsg(result: AdiagResult): string {
        return Adiag.compileMsg(result.raw, result.data as Record<string, unknown>);
    }

    /**
     * Compiles full message including causal chain explanations
     */
    static resultToChainMsg(result: AdiagResult): string {
        const chain = Adiag.getCauseChain(result);
        return chain.map((r, i) => `${i > 0 ? "  -> " : ""}${Adiag.resultToMsg(r) || r.code || r.type}`).join("\n");
    }
}
