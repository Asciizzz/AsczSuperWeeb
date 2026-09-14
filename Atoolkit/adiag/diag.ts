export type DiagType = "ok" | "err" | "warn" | "info" | string;

export interface DiagResult {
    type: DiagType;
    code: string;
    raw: string;
    data: unknown;
    ref?: DiagResult | null; // Causal reference pointer to another diagnostic result
}

export interface DiagAddArgs {
    code?: string;
    raw?: string;
    data?: unknown;
    ref?: DiagResult | null;
}

// ==================== Diag =====================

export class Diag {
    state: Record<string, unknown> = {}; // shared state for all diag
    readonly maxHistory: number;

    #buffer: (DiagResult | null)[];
    #head = 0;
    #count = 0;
    private readonly _listeners = new Map<string, Set<(result: DiagResult) => void>>();

    static readonly TYPE_OK   = "ok";
    static readonly TYPE_ERR  = "err";
    static readonly TYPE_WARN = "warn";
    static readonly TYPE_INFO = "info";

    constructor(maxHistory = 1000) {
        this.maxHistory = maxHistory;
        this.#buffer = new Array(maxHistory).fill(null);
    }

    get results(): DiagResult[] {
        if (this.#count === 0) return [];
        const res: DiagResult[] = new Array(this.#count);
        const start = (this.#head - this.#count + this.maxHistory) % this.maxHistory;
        for (let i = 0; i < this.#count; i++) {
            res[i] = this.#buffer[(start + i) % this.maxHistory]!;
        }
        return res;
    }

    set results(items: DiagResult[]) {
        this.clear();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            this.#add(item.type, item);
        }
    }

    ok(args: DiagAddArgs = {}):   DiagResult { return this.#add(Diag.TYPE_OK,   args); }
    err(args: DiagAddArgs = {}):  DiagResult { return this.#add(Diag.TYPE_ERR,  args); }
    warn(args: DiagAddArgs = {}): DiagResult { return this.#add(Diag.TYPE_WARN, args); }
    info(args: DiagAddArgs = {}): DiagResult { return this.#add(Diag.TYPE_INFO, args); }

    /**
     * Subscribes to diagnostic records of specified category type, or '*' for all records.
     * Returns an unsubscribe function.
     */
    on(type: DiagType | "*", listener: (result: DiagResult) => void): () => void {
        let set = this._listeners.get(type);
        if (!set) {
            set = new Set();
            this._listeners.set(type, set);
        }
        set.add(listener);
        return () => {
            set?.delete(listener);
            if (set && set.size === 0) this._listeners.delete(type);
        };
    }

    onError(listener: (result: DiagResult) => void): () => void {
        return this.on(Diag.TYPE_ERR, listener);
    }

    onWarn(listener: (result: DiagResult) => void): () => void {
        return this.on(Diag.TYPE_WARN, listener);
    }

    #add(type: DiagType, { code = "", raw = "", data = null, ref = null }: DiagAddArgs = {}): DiagResult {
        const item: DiagResult = { type, code, raw, data, ref };
        this.#buffer[this.#head] = item;
        this.#head = (this.#head + 1) % this.maxHistory;
        if (this.#count < this.maxHistory) {
            this.#count++;
        }

        const typeListeners = this._listeners.get(type);
        if (typeListeners) {
            for (const fn of typeListeners) fn(item);
        }
        const allListeners = this._listeners.get("*");
        if (allListeners) {
            for (const fn of allListeners) fn(item);
        }

        return item;
    }

    clear(): void {
        this.#head = 0;
        this.#count = 0;
        this.#buffer.fill(null);
    }

    last(): DiagResult | null {
        if (this.#count === 0) return null;
        const lastIdx = (this.#head - 1 + this.maxHistory) % this.maxHistory;
        return this.#buffer[lastIdx];
    }

    lastErr(): DiagResult | null {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Diag.TYPE_ERR) {
                return item;
            }
        }
        return null;
    }

    allOk(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type !== Diag.TYPE_OK) return false;
        }
        return true;
    }

    private _findType(type: string): DiagResult[] {
        if (this.#count === 0) return [];
        const res: DiagResult[] = [];
        const start = (this.#head - this.#count + this.maxHistory) % this.maxHistory;
        for (let i = 0; i < this.#count; i++) {
            const item = this.#buffer[(start + i) % this.maxHistory];
            if (item && item.type === type) {
                res.push(item);
            }
        }
        return res;
    }

    findOk(): DiagResult[] {
        return this._findType(Diag.TYPE_OK);
    }

    hasErrs(): boolean {
        return this.lastErr() !== null;
    }

    findErrs(): DiagResult[] {
        return this._findType(Diag.TYPE_ERR);
    }

    hasWarns(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Diag.TYPE_WARN) return true;
        }
        return false;
    }

    findWarns(): DiagResult[] {
        return this._findType(Diag.TYPE_WARN);
    }

    hasInfos(): boolean {
        for (let i = 0; i < this.#count; i++) {
            const idx = (this.#head - 1 - i + this.maxHistory) % this.maxHistory;
            const item = this.#buffer[idx];
            if (item && item.type === Diag.TYPE_INFO) return true;
        }
        return false;
    }

    findInfos(): DiagResult[] {
        return this._findType(Diag.TYPE_INFO);
    }

    /**
     * Extracts the causal reference chain starting from `result` in order of causality.
     */
    static getCauseChain(result: DiagResult | null | undefined): DiagResult[] {
        const chain: DiagResult[] = [];
        let curr: DiagResult | null | undefined = result;
        const seen = new Set<DiagResult>();

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

    /**
     * Formats diagnostic result into human-readable string with causal chain details.
     */
    static formatResult(result: DiagResult): string {
        const compiled = Diag.resultToMsg(result);
        const prefix = `[${result.type.toUpperCase()}]${result.code ? ` (${result.code})` : ""}: `;
        return `${prefix}${compiled || result.raw || "No message"}`;
    }

    static resultToMsg(result: DiagResult): string {
        return Diag.compileMsg(result.raw, result.data as Record<string, unknown>);
    }

    /**
     * Compiles full message including causal chain explanations
     */
    static resultToChainMsg(result: DiagResult): string {
        const chain = Diag.getCauseChain(result);
        return chain.map((r, i) => `${i > 0 ? "  -> " : ""}${Diag.resultToMsg(r) || r.code || r.type}`).join("\n");
    }
}
