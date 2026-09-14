import { Acmp } from "../../acmp/index.js";
import type { Adiag } from "../../../Atoolkit/adiag/index.js";
import type { Awgl2Ctx } from "../ctx.js";

// ==================== Types =====================

export interface VertexBufferEntry {
    slot?:   number;
    buffer:  WebGLBuffer;
    offset?: number;
}

export interface IndexBufferEntry {
    buffer: WebGLBuffer;
    /** gl.UNSIGNED_SHORT | gl.UNSIGNED_INT (resolved at exec time) */
    type?:  number;
}

export interface SetBuffersData {
    vao?:     WebGLVertexArrayObject | null;
    vertex?:  VertexBufferEntry | VertexBufferEntry[];
    vertices?: VertexBufferEntry | VertexBufferEntry[]; // alias
    index?:   IndexBufferEntry | null;
}

// ==================== Helpers =====================

function uint(value: unknown, fallback = 0): number {
    return Math.max(0, Number(value ?? fallback) | 0);
}

function toList<T>(value: T | T[] | undefined | null): T[] {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
}

// ==================== Components =====================

/**
 * Binds a VAO (required) and optional raw VBO/EBO overrides.
 *
 * In WebGL2 the VAO encodes all attribute pointers; normally you just bind
 * the VAO and draw. The optional vertex/index entries let you swap individual
 * buffers without creating a new VAO.
 */
export class SetBuffers extends Acmp<Awgl2Ctx> {
    readonly vao:    WebGLVertexArrayObject | null;
    readonly vertex: VertexBufferEntry[];
    readonly index:  IndexBufferEntry | null;

    constructor(data: SetBuffersData = {}) {
        super();
        this.vao    = data.vao ?? null;
        const verts = data.vertex ?? data.vertices;
        this.vertex = toList(verts);
        this.index  = data.index ?? null;
    }

    override exec(ctx: Awgl2Ctx, _diag?: Adiag): void {
        if (!ctx.gl || ctx.passKind !== "render") return;
        const gl = ctx.gl;

        if (this.vao) {
            gl.bindVertexArray(this.vao);
            ctx.vao = this.vao;
        }

        for (const entry of this.vertex) {
            const buf = entry?.buffer ?? null;
            if (!buf) continue;
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            ctx.buffers.vertex.set(uint(entry.slot), buf);
        }

        if (this.index?.buffer) {
            const type = this.index.type ?? gl.UNSIGNED_SHORT;
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.index.buffer);
            ctx.buffers.index = { buffer: this.index.buffer, type };
        }
    }
}
