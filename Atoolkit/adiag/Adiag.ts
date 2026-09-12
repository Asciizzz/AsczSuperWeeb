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
    state: Record<string, unknown> = {}; // shared state for all diag
    readonly maxHistory: number;

    #buffer: (AdiagResult | null)[];
    #head = 0;
    #count = 0;

    static readonly TYPE_OK   = "ok";
    static readonly TYPE_ERR  = "err";
    static readonly TYPE_WARN = "warn";
    static readonly TYPE_INFO = "info";

    constructor(maxHistory = 1000) {
        this.maxHistory = maxHistory;
        this.#buffer = new Array(maxHistory).fill(null);
    }

    get results(): AdiagResult[] {
        if (this.#count === 0) return [];
        const res: AdiagResult[] = new Array(this.#count);
        const start = (this.#head - this.#count + this.maxHistory) % this.maxHistory;
        for (let i = 0; i < this.#count; i++) {
            res[i] = this.#buffer[(start + i) % this.maxHistory]!;
        }
        return res;
    }

    set results(items: AdiagResult[]) {
        this.clear();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            this.#add(item.type, item);
        }
    }

    ok(args: AdiagAddArgs = {}):   AdiagResult { return this.#add(Adiag.TYPE_OK,   args); }
    err(args: AdiagAddArgs = {}):  AdiagResult { return this.#add(Adiag.TYPE_ERR,  args); }
    warn(args: AdiagAddArgs = {}): AdiagResult { return this.#add(Adiag.TYPE_WARN, args); }
    info(args: AdiagAddArgs = {}): AdiagResult { return this.#add(Adiag.TYPE_INFO, args); }

    #add(type: string, { code = "", raw = "", data = null, ref = null }: AdiagAddArgs = {}): AdiagResult {
        const item: AdiagResult = { type, code, raw, data, ref };
        this.#buffer[this.#head] = item;
        this.#head = (this.#head + 1) % this.maxHistory;
        if (this.#count < this.maxHistory) {
            this.#count++;
        }
        return item;
    }

    clear(): void {
        this.#head = 0;
        this.#count = 0;
        this.#buffer.fill(null);
    }

    last(): AdiagResult | null {
        if (this.#count === 0) return null;
        const lastIdx = (this.#head - 1 + this.maxHistory) % this.maxHistory;
        return this.#buffer[lastIdx];
    }

    lastErr(): AdiagResult | null {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Adiag.TYPE_ERR) {
                return item;
            }
        }
        return null;
    }

    allOk(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type !== Adiag.TYPE_OK) return false;
        }
        return true;
    }

    findOk(): AdiagResult[] {
        return this.results.filter(r => r.type === Adiag.TYPE_OK);
    }

    hasErrs(): boolean {
        return this.lastErr() !== null;
    }

    findErrs(): AdiagResult[] {
        return this.results.filter(r => r.type === Adiag.TYPE_ERR);
    }

    hasWarns(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Adiag.TYPE_WARN) return true;
        }
        return false;
    }

    findWarns(): AdiagResult[] {
        return this.results.filter(r => r.type === Adiag.TYPE_WARN);
    }

    hasInfos(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Adiag.TYPE_INFO) return true;
        }
        return false;
    }

    findInfos(): AdiagResult[] {
        return this.results.filter(r => r.type === Adiag.TYPE_INFO);
    }

    /**
     * Extracts the causal reference chain starting from `result` in order of causality.
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
