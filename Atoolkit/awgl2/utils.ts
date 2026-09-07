import { Adiag } from "../adiag/index.js";

// ==================== Types =====================

export interface CreateGlBufferOptions {
    target?: number;
    data?: ArrayBufferView | ArrayBuffer | null;
    size?: number;
    usage?: number;
    diag?: Adiag;
}

export interface CreateProgramOptions {
    vs: string;
    fs: string;
    diag?: Adiag;
}

export interface VertexAttributePointer {
    location: number;
    size: number;
    type?: number;
    normalized?: boolean;
    stride?: number;
    offset?: number;
    divisor?: number;
}

export interface CreateVaoOptions {
    attributes: Array<{
        buffer: WebGLBuffer;
        attributes: VertexAttributePointer[];
    }>;
    indexBuffer?: WebGLBuffer | null;
    diag?: Adiag;
}

export interface CreateGlTexture2DOptions {
    width: number;
    height: number;
    internalFormat?: number;
    format?: number;
    type?: number;
    data?: ArrayBufferView | null;
    minFilter?: number;
    magFilter?: number;
    wrapS?: number;
    wrapT?: number;
    generateMipmaps?: boolean;
    diag?: Adiag;
}

export interface CreateGlFramebufferOptions {
    colorTextures?: WebGLTexture[];
    depthTexture?: WebGLTexture | null;
    depthRenderbuffer?: WebGLRenderbuffer | null;
    diag?: Adiag;
}

// ==================== Low-Level WebGL2 Utilities =====================

/**
 * Creates and initializes a WebGLBuffer with raw typed byte data or fixed allocation size.
 */
export function createBuffer(gl: WebGL2RenderingContext, options: CreateGlBufferOptions = {}): WebGLBuffer | null {
    if (!gl) {
        options.diag?.err({ code: "INVALID_GL_CONTEXT", raw: "createBuffer: WebGL2RenderingContext is required" });
        return null;
    }

    const target = options.target ?? gl.ARRAY_BUFFER;
    const usage = options.usage ?? gl.STATIC_DRAW;

    try {
        const buffer = gl.createBuffer();
        if (!buffer) {
            options.diag?.err({ code: "CREATE_BUFFER_FAILED", raw: "gl.createBuffer returned null" });
            return null;
        }

        gl.bindBuffer(target, buffer);

        if (options.data) {
            gl.bufferData(target, options.data as any, usage);
        } else if (options.size != null && options.size > 0) {
            gl.bufferData(target, options.size, usage);
        }

        gl.bindBuffer(target, null);
        options.diag?.ok({ code: "CREATE_BUFFER_OK" });
        return buffer;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_BUFFER_FAILED",
            raw: "createBuffer failed: $error$",
            data: { error }
        });
        return null;
    }
}

/**
 * Compiles a vertex & fragment shader and links them into a WebGLProgram, reporting diagnostics on failure.
 */
export function createProgram(gl: WebGL2RenderingContext, options: CreateProgramOptions): WebGLProgram | null {
    if (!gl) {
        options.diag?.err({ code: "INVALID_GL_CONTEXT", raw: "createProgram: WebGL2RenderingContext is required" });
        return null;
    }

    const compileShader = (type: number, source: string, typeName: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) {
            options.diag?.err({ code: "CREATE_SHADER_FAILED", raw: `gl.createShader returned null for ${typeName}` });
            return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!success) {
            const log = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error";
            gl.deleteShader(shader);
            options.diag?.err({
                code: "SHADER_COMPILE_ERROR",
                raw: `WebGL2 ${typeName} compile error: $log$`,
                data: { log, typeName }
            });
            return null;
        }

        return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, options.vs, "VERTEX_SHADER");
    if (!vs) return null;

    const fs = compileShader(gl.FRAGMENT_SHADER, options.fs, "FRAGMENT_SHADER");
    if (!fs) {
        gl.deleteShader(vs);
        return null;
    }

    const program = gl.createProgram();
    if (!program) {
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        options.diag?.err({ code: "CREATE_PROGRAM_FAILED", raw: "gl.createProgram returned null" });
        return null;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        const log = gl.getProgramInfoLog(program) ?? "Unknown program link error";
        gl.deleteProgram(program);
        options.diag?.err({
            code: "PROGRAM_LINK_ERROR",
            raw: "WebGL2 program link error: $log$",
            data: { log }
        });
        return null;
    }

    options.diag?.ok({ code: "CREATE_PROGRAM_OK" });
    return program;
}

/**
 * Creates and configures a WebGLVertexArrayObject (VAO) with buffer bindings and attribute pointers.
 */
export function createVao(gl: WebGL2RenderingContext, options: CreateVaoOptions): WebGLVertexArrayObject | null {
    if (!gl) {
        options.diag?.err({ code: "INVALID_GL_CONTEXT", raw: "createVao: WebGL2RenderingContext is required" });
        return null;
    }

    try {
        const vao = gl.createVertexArray();
        if (!vao) {
            options.diag?.err({ code: "CREATE_VAO_FAILED", raw: "gl.createVertexArray returned null" });
            return null;
        }

        gl.bindVertexArray(vao);

        for (const entry of options.attributes) {
            gl.bindBuffer(gl.ARRAY_BUFFER, entry.buffer);

            for (const attr of entry.attributes) {
                gl.enableVertexAttribArray(attr.location);
                gl.vertexAttribPointer(
                    attr.location,
                    attr.size,
                    attr.type ?? gl.FLOAT,
                    attr.normalized ?? false,
                    attr.stride ?? 0,
                    attr.offset ?? 0
                );

                if (attr.divisor && attr.divisor > 0) {
                    gl.vertexAttribDivisor(attr.location, attr.divisor);
                }
            }
        }

        if (options.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, options.indexBuffer);
        }

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        if (options.indexBuffer) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        options.diag?.ok({ code: "CREATE_VAO_OK" });
        return vao;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_VAO_FAILED",
            raw: "createVao failed: $error$",
            data: { error }
        });
        return null;
    }
}

/**
 * Creates and uploads a 2D WebGLTexture.
 */
export function createTexture2D(gl: WebGL2RenderingContext, options: CreateGlTexture2DOptions): WebGLTexture | null {
    if (!gl) {
        options.diag?.err({ code: "INVALID_GL_CONTEXT", raw: "createTexture2D: WebGL2RenderingContext is required" });
        return null;
    }

    try {
        const texture = gl.createTexture();
        if (!texture) {
            options.diag?.err({ code: "CREATE_TEXTURE_FAILED", raw: "gl.createTexture returned null" });
            return null;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);

        const internalFormat = options.internalFormat ?? gl.RGBA8;
        const format = options.format ?? gl.RGBA;
        const type = options.type ?? gl.UNSIGNED_BYTE;
        const minFilter = options.minFilter ?? gl.LINEAR;
        const magFilter = options.magFilter ?? gl.LINEAR;
        const wrapS = options.wrapS ?? gl.CLAMP_TO_EDGE;
        const wrapT = options.wrapT ?? gl.CLAMP_TO_EDGE;

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            internalFormat,
            options.width,
            options.height,
            0,
            format,
            type,
            options.data ?? null
        );

        if (options.generateMipmaps) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);

        options.diag?.ok({ code: "CREATE_TEXTURE_OK", data: { width: options.width, height: options.height } });
        return texture;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_TEXTURE_FAILED",
            raw: "createTexture2D failed: $error$",
            data: { error }
        });
        return null;
    }
}

/**
 * Creates and validates a WebGLFramebuffer.
 */
export function createFramebuffer(gl: WebGL2RenderingContext, options: CreateGlFramebufferOptions = {}): WebGLFramebuffer | null {
    if (!gl) {
        options.diag?.err({ code: "INVALID_GL_CONTEXT", raw: "createFramebuffer: WebGL2RenderingContext is required" });
        return null;
    }

    try {
        const fbo = gl.createFramebuffer();
        if (!fbo) {
            options.diag?.err({ code: "CREATE_FBO_FAILED", raw: "gl.createFramebuffer returned null" });
            return null;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        if (options.colorTextures) {
            for (let i = 0; i < options.colorTextures.length; i++) {
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0 + i,
                    gl.TEXTURE_2D,
                    options.colorTextures[i],
                    0
                );
            }
        }

        if (options.depthTexture) {
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.TEXTURE_2D,
                options.depthTexture,
                0
            );
        } else if (options.depthRenderbuffer) {
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.RENDERBUFFER,
                options.depthRenderbuffer
            );
        }

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            gl.deleteFramebuffer(fbo);
            options.diag?.err({
                code: "INCOMPLETE_FRAMEBUFFER",
                raw: "WebGLFramebuffer incomplete with status code: $status$",
                data: { status }
            });
            return null;
        }

        options.diag?.ok({ code: "CREATE_FBO_OK" });
        return fbo;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_FBO_FAILED",
            raw: "createFramebuffer failed: $error$",
            data: { error }
        });
        return null;
    }
}
