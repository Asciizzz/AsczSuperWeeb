import { Adiag } from "../../Atoolkit/adiag/index.js";

// ==================== Types =====================

export interface CreateBufferOptions {
    label?: string;
    data?: ArrayBufferView | ArrayBuffer;
    size?: number;
    usage: GPUBufferUsageFlags;
    mappedAtCreation?: boolean;
    diag?: Adiag;
}

export interface CreateUniformBufferOptions {
    label?: string;
    data?: ArrayBufferView | ArrayBuffer;
    size?: number;
    usage?: GPUBufferUsageFlags;
    diag?: Adiag;
}

export interface CreateShaderModuleOptions {
    label?: string;
    code: string;
    validate?: boolean;
    diag?: Adiag;
}

export interface CreateDepthTextureOptions {
    label?: string;
    width: number;
    height: number;
    format?: GPUTextureFormat;
    sampleCount?: number;
    usage?: GPUTextureUsageFlags;
    diag?: Adiag;
}

export interface CreateTexture2DOptions {
    label?: string;
    width: number;
    height: number;
    format?: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    sampleCount?: number;
    diag?: Adiag;
}

export interface VertexAttributeDescriptor {
    format: GPUVertexFormat;
    shaderLocation: number;
    offset?: number;
}

// ==================== Format Sizes =====================

const VERTEX_FORMAT_SIZES: Record<string, number> = {
    "float32": 4,
    "float32x2": 8,
    "float32x3": 12,
    "float32x4": 16,
    "uint32": 4,
    "uint32x2": 8,
    "uint32x3": 12,
    "uint32x4": 16,
    "sint32": 4,
    "sint32x2": 8,
    "sint32x3": 12,
    "sint32x4": 16,
    "float16x2": 4,
    "float16x4": 8,
    "unorm8x2": 2,
    "unorm8x4": 4,
    "snorm8x2": 2,
    "snorm8x4": 4,
    "uint8x2": 2,
    "uint8x4": 4,
    "sint8x2": 2,
    "sint8x4": 4,
    "unorm16x2": 4,
    "unorm16x4": 8,
    "snorm16x2": 4,
    "snorm16x4": 8,
    "uint16x2": 4,
    "uint16x4": 8,
    "sint16x2": 4,
    "sint16x4": 8,
};

// ==================== Low-Level WebGPU Utilities =====================

/**
 * Creates and initializes a GPUBuffer with raw typed byte data or fixed allocation size.
 */
export function createBuffer(device: GPUDevice, options: CreateBufferOptions): GPUBuffer | null {
    if (!device) {
        options.diag?.err({ code: "INVALID_DEVICE", raw: "createBuffer: GPUDevice is required" });
        return null;
    }

    const data = options.data;
    let byteLength = options.size ?? 0;

    if (data) {
        byteLength = data.byteLength;
    }

    if (byteLength <= 0) {
        options.diag?.err({
            code: "INVALID_BUFFER_SIZE",
            raw: "createBuffer: buffer size must be greater than 0, got $size$",
            data: { size: byteLength }
        });
        return null;
    }

    // WebGPU requires buffer size to be a multiple of 4 bytes
    const alignedSize = Math.max(4, Math.ceil(byteLength / 4) * 4);

    try {
        if (data) {
            const buffer = device.createBuffer({
                label: options.label,
                size: alignedSize,
                usage: options.usage,
                mappedAtCreation: true,
            });

            const arrayBuffer = buffer.getMappedRange();
            if (data instanceof ArrayBuffer) {
                new Uint8Array(arrayBuffer).set(new Uint8Array(data));
            } else {
                new Uint8Array(arrayBuffer).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            }
            buffer.unmap();

            options.diag?.ok({ code: "CREATE_BUFFER_OK", data: { label: options.label, size: alignedSize } });
            return buffer;
        }

        const buffer = device.createBuffer({
            label: options.label,
            size: alignedSize,
            usage: options.usage,
            mappedAtCreation: options.mappedAtCreation ?? false,
        });

        options.diag?.ok({ code: "CREATE_BUFFER_OK", data: { label: options.label, size: alignedSize } });
        return buffer;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_BUFFER_FAILED",
            raw: "createBuffer failed for '$label$': $error$",
            data: { label: options.label, error }
        });
        return null;
    }
}

/**
 * Allocates a UNIFORM | COPY_DST GPUBuffer.
 */
export function createUniformBuffer(device: GPUDevice, options: CreateUniformBufferOptions): GPUBuffer | null {
    return createBuffer(device, {
        ...options,
        usage: options.usage ?? (GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
    });
}

/**
 * Compiles a WGSL shader module with optional compilation diagnostic checking.
 */
export function createShaderModule(device: GPUDevice, options: CreateShaderModuleOptions): GPUShaderModule | null {
    if (!device) {
        options.diag?.err({ code: "INVALID_DEVICE", raw: "createShaderModule: GPUDevice is required" });
        return null;
    }

    try {
        const shaderModule = device.createShaderModule({
            label: options.label,
            code: options.code,
        });

        if (options.validate && options.diag) {
            shaderModule.getCompilationInfo().then((info) => {
                for (const msg of info.messages) {
                    if (msg.type === "error") {
                        options.diag?.err({
                            code: "WGSL_COMPILATION_ERROR",
                            raw: "WGSL error at line $lineNum$:$linePos$: $message$",
                            data: { lineNum: msg.lineNum, linePos: msg.linePos, message: msg.message }
                        });
                    } else if (msg.type === "warning") {
                        options.diag?.warn({
                            code: "WGSL_COMPILATION_WARNING",
                            raw: "WGSL warning at line $lineNum$: $message$",
                            data: { lineNum: msg.lineNum, message: msg.message }
                        });
                    }
                }
            }).catch(() => { /* ignore */ });
        }

        options.diag?.ok({ code: "CREATE_SHADER_MODULE_OK", data: { label: options.label } });
        return shaderModule;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_SHADER_MODULE_FAILED",
            raw: "createShaderModule failed for '$label$': $error$",
            data: { label: options.label, error }
        });
        return null;
    }
}

/**
 * Creates a standard depth/stencil GPUTexture for render targets.
 */
export function createDepthTexture(device: GPUDevice, options: CreateDepthTextureOptions): GPUTexture | null {
    if (!device) {
        options.diag?.err({ code: "INVALID_DEVICE", raw: "createDepthTexture: GPUDevice is required" });
        return null;
    }

    const width = Math.max(1, options.width | 0);
    const height = Math.max(1, options.height | 0);
    const format = options.format ?? "depth24plus";
    const usage = options.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;

    try {
        const texture = device.createTexture({
            label: options.label ?? "DepthTexture",
            size: [width, height, 1],
            format,
            sampleCount: options.sampleCount ?? 1,
            usage,
        });

        options.diag?.ok({ code: "CREATE_DEPTH_TEXTURE_OK", data: { label: options.label, width, height, format } });
        return texture;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_DEPTH_TEXTURE_FAILED",
            raw: "createDepthTexture failed for '$label$': $error$",
            data: { label: options.label, error }
        });
        return null;
    }
}

/**
 * Creates a 2D GPUTexture.
 */
export function createTexture2D(device: GPUDevice, options: CreateTexture2DOptions): GPUTexture | null {
    if (!device) {
        options.diag?.err({ code: "INVALID_DEVICE", raw: "createTexture2D: GPUDevice is required" });
        return null;
    }

    const width = Math.max(1, options.width | 0);
    const height = Math.max(1, options.height | 0);
    const format = options.format ?? "rgba8unorm";

    try {
        const texture = device.createTexture({
            label: options.label ?? "Texture2D",
            size: [width, height, 1],
            format,
            sampleCount: options.sampleCount ?? 1,
            usage: options.usage,
        });

        options.diag?.ok({ code: "CREATE_TEXTURE_2D_OK", data: { label: options.label, width, height, format } });
        return texture;
    } catch (error) {
        options.diag?.err({
            code: "CREATE_TEXTURE_2D_FAILED",
            raw: "createTexture2D failed for '$label$': $error$",
            data: { label: options.label, error }
        });
        return null;
    }
}

/**
 * Calculates attribute byte offsets and total stride, returning a GPUVertexBufferLayout.
 */
export function createVertexLayout(
    attributes: VertexAttributeDescriptor[],
    stepMode: GPUVertexStepMode = "vertex"
): GPUVertexBufferLayout {
    let currentOffset = 0;
    let maxEnd = 0;
    const gpuAttributes: GPUVertexAttribute[] = [];

    for (const attr of attributes) {
        const offset = attr.offset ?? currentOffset;
        const formatSize = VERTEX_FORMAT_SIZES[attr.format];
        if (formatSize === undefined) {
            throw new Error(`[Awgpu] Unsupported vertex format "${attr.format}".`);
        }
        gpuAttributes.push({
            format: attr.format,
            offset,
            shaderLocation: attr.shaderLocation,
        });

        currentOffset = offset + formatSize;
        maxEnd = Math.max(maxEnd, currentOffset);
    }

    // Align total stride to 4 bytes
    const arrayStride = Math.ceil(maxEnd / 4) * 4;

    return {
        arrayStride,
        stepMode,
        attributes: gpuAttributes,
    };
}
