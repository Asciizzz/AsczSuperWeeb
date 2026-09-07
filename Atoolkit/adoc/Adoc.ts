/* Adoc
By Asciiz

Small string document compiler with staged replacement instructions.
Exists because writing regexes every time is annoying.
This library is like... the funniest one here because... what the actual fuck are you doing here?
*/

// ==================== Types =====================

export type MatchMode   = "caseSensitive" | "caseInsensitive" | "regex";
export type ReplaceMode = "first" | "all";

export interface AdocRules {
    matchMode?:   MatchMode;
    replaceMode?: ReplaceMode;
}

export interface AdocInstruction {
    key?:   string;
    regex?: RegExp | string;
    value:  string;
    rules?: AdocRules;
}

export interface AdocDst {
    value: string;
}

// ==================== Adoc =====================

export class Adoc {
    static readonly CASE_SENSITIVE   = "caseSensitive"   as const;
    static readonly CASE_INSENSITIVE = "caseInsensitive" as const;
    static readonly REGEX            = "regex"           as const;

    static readonly REPLACE_FIRST = "first" as const;
    static readonly REPLACE_ALL   = "all"   as const;

    src:          string;
    dst:          string;
    instructions: AdocInstruction[];

    static str(value: unknown): string {
        return String(value ?? "");
    }

    static escapeRegex(value: unknown): string {
        return Adoc.str(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    static flags(rules: AdocRules = {}): string {
        const replaceMode = rules.replaceMode ?? Adoc.REPLACE_ALL;
        const matchMode   = rules.matchMode   ?? Adoc.CASE_SENSITIVE;
        return [
            replaceMode === Adoc.REPLACE_ALL   ? "g" : "",
            matchMode   === Adoc.CASE_INSENSITIVE ? "i" : "",
        ].join("");
    }

    static regex(instruction: AdocInstruction): RegExp {
        if (instruction.regex instanceof RegExp) return instruction.regex;
        const key      = instruction.regex ?? instruction.key;
        const regexSrc = instruction.rules?.matchMode === Adoc.REGEX
            ? Adoc.str(key)
            : Adoc.escapeRegex(key);
        return new RegExp(regexSrc, Adoc.flags(instruction.rules));
    }

    static write(value: unknown, dst: AdocDst | null = null): string {
        const out = Adoc.str(value);
        if (dst && typeof dst === "object") dst.value = out;
        return out;
    }

    static replace(src: unknown, instruction: AdocInstruction, dst: AdocDst | null = null): string {
        return Adoc.write(
            Adoc.str(src).replace(Adoc.regex(instruction), Adoc.str(instruction.value)),
            dst,
        );
    }

    static compile(src: unknown, instructions: AdocInstruction[] = [], dst: AdocDst | null = null): string {
        let out = Adoc.str(src);
        for (const instruction of instructions) out = Adoc.replace(out, instruction);
        return Adoc.write(out, dst);
    }

    constructor(src = "") {
        this.src          = Adoc.str(src);
        this.dst          = this.src;
        this.instructions = [];
    }

    setSrc(src: unknown): this {
        this.src = Adoc.str(src);
        return this;
    }

    clearInstructions(): this {
        this.instructions.length = 0;
        return this;
    }

    addInstruction(instruction: AdocInstruction): AdocInstruction {
        this.instructions.push(instruction);
        return instruction;
    }

    addInstructions(instructions: AdocInstruction[] = []): this {
        for (const instruction of instructions) this.addInstruction(instruction);
        return this;
    }

    execute(src: unknown = this.src, writeSrc = true): string {
        this.src = Adoc.str(src);
        this.dst = Adoc.compile(this.src, this.instructions);
        if (writeSrc) this.src = this.dst;
        this.clearInstructions();
        return this.dst;
    }
}

export default Adoc;
