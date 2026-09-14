import type { Awgl2Ctx } from "./ctx.js";

// ==================== Types =====================

export interface Awgl2BackendOptions {
    context?: WebGLContextAttributes;
}

export interface ResizeOptions {
    pixelRatio?:    number;
    maxPixelRatio?: number;
    width?:         number;
    height?:        number;
}

// ==================== Helpers =====================

function resolveCanvas(canvasRef: string | HTMLCanvasElement | null | undefined): HTMLCanvasElement | null {
    if (!canvasRef) return null;
    if (typeof HTMLCanvasElement !== "undefined" && canvasRef instanceof HTMLCanvasElement) return canvasRef;
    if (typeof canvasRef === "string" && typeof document !== "undefined") {
        const found = document.querySelector(canvasRef);
        if (typeof HTMLCanvasElement !== "undefined" && found instanceof HTMLCanvasElement) return found;
    }
    return null;
}

function toNumber(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

// ==================== Backend =====================

export class Backend {
    canvas:  HTMLCanvasElement | null    = null;
    options: Awgl2BackendOptions         = {};
    gl:      WebGL2RenderingContext | null = null;
    ready:   boolean = false;

    depth: {
        renderbuffer: WebGLRenderbuffer | null;
        fbo:          WebGLFramebuffer  | null;
        width:        number;
        height:       number;
    } = { renderbuffer: null, fbo: null, width: 0, height: 0 };

    constructor(canvas: string | HTMLCanvasElement | null = null, options: Awgl2BackendOptions = {}) {
        this.canvas  = resolveCanvas(canvas);
        this.options = options ?? {};
    }

    static async create(canvas: string | HTMLCanvasElement, options: Awgl2BackendOptions = {}): Promise<Backend> {
        const backend = new Backend(canvas, options);
        backend.init();
        return backend;
    }

    init(): this {
        if (!this.canvas) throw new Error("[Awgl2.Backend] canvas is required");
        const gl = this.canvas.getContext("webgl2", this.options.context ?? {}) as WebGL2RenderingContext | null;
        if (!gl) throw new Error("[Awgl2.Backend] WebGL2 context creation failed");
        this.gl    = gl;
        this.ready = true;
        return this;
    }

    resize(options: ResizeOptions = {}): boolean {
        if (!this.ready || !this.canvas || !this.gl) return false;
        const dpr          = Math.max(1, toNumber(options.pixelRatio,    globalThis.devicePixelRatio ?? 1));
        const maxPixelRatio = Math.max(1, toNumber(options.maxPixelRatio, 2));
        const ratio         = Math.min(dpr, maxPixelRatio);
        const width  = Math.max(1, Math.floor(toNumber(options.width  ?? this.canvas.clientWidth  ?? this.canvas.width,  1) * ratio));
        const height = Math.max(1, Math.floor(toNumber(options.height ?? this.canvas.clientHeight ?? this.canvas.height, 1) * ratio));
        if (this.canvas.width === width && this.canvas.height === height) return false;
        this.canvas.width  = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
        this.releaseDepth();
        return true;
    }

    /** Creates a fresh mutable context for recording a frame. */
    newCtx(): Awgl2Ctx {
        return {
            backend:     this,
            gl:          this.gl,
            passKind:    null,
            program:     null,
            vao:         null,
            framebuffer: null,
            buffers: {
                vertex: new Map(),
                index:  null,
            },
            textures: new Map(),
            ended:    false,
        };
    }

    getDepthRenderbuffer(width: number, height: number): WebGLRenderbuffer | null {
        const gl = this.gl;
        if (!gl) return null;
        const w = Math.max(1, width | 0);
        const h = Math.max(1, height | 0);
        if (this.depth.renderbuffer && this.depth.width === w && this.depth.height === h) {
            return this.depth.renderbuffer;
        }
        this.releaseDepth();
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        this.depth.renderbuffer = rb;
        this.depth.width        = w;
        this.depth.height       = h;
        return rb;
    }

    releaseDepth(): void {
        if (this.depth.renderbuffer && this.gl) {
            this.gl.deleteRenderbuffer(this.depth.renderbuffer);
        }
        this.depth.renderbuffer = null;
        this.depth.fbo          = null;
        this.depth.width        = 0;
        this.depth.height       = 0;
    }

    destroy(): void {
        this.releaseDepth();
        this.ready  = false;
        this.gl     = null;
        this.canvas = null;
    }
}

export default Backend;
