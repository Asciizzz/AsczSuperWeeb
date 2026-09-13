export type AwgpuBufferData =
    | BufferSource
    | ArrayBufferView
    | Float32Array
    | Uint16Array
    | Uint32Array
    | Uint8Array
    | Int32Array
    | ArrayBuffer;

/**
 * GPU buffer wrapper supporting uniform, storage, vertex, and index operations.
 */
export class AwgpuBuffer {
    readonly gpuBuffer: GPUBuffer;
    readonly size: number;
    readonly usage: GPUBufferUsageFlags;
    readonly label: string;
    readonly gpuOwned: boolean;

    constructor(
        gpuBuffer: GPUBuffer,
        size: number,
        usage: GPUBufferUsageFlags,
        options: { label?: string; gpuOwned?: boolean } = {}
    ) {
        this.gpuBuffer = gpuBuffer;
        this.size = size;
        this.usage = usage;
        this.label = options.label ?? gpuBuffer.label ?? "AwgpuBuffer";
        this.gpuOwned = options.gpuOwned ?? true;
    }

    /**
     * Uploads fresh data to GPU buffer using queue.writeBuffer.
     */
    write(device: GPUDevice, data: AwgpuBufferData, bufferOffset = 0): void {
        const view = data as ArrayBufferView;
        const byteLength = view.byteLength ?? (data as ArrayBuffer).byteLength;
        const buffer = view.buffer ?? (data as ArrayBuffer);
        const byteOffset = view.byteOffset ?? 0;
        device.queue.writeBuffer(
            this.gpuBuffer,
            bufferOffset,
            buffer as ArrayBuffer,
            byteOffset,
            byteLength
        );
    }

    destroy(): void {
        if (this.gpuOwned) {
            this.gpuBuffer.destroy();
        }
    }

    /**
     * Creates raw GPU buffer with optional initial data upload.
     */
    static create(
        device: GPUDevice,
        options: {
            size: number;
            usage: GPUBufferUsageFlags;
            data?: AwgpuBufferData;
            label?: string;
        }
    ): AwgpuBuffer {
        // Enforce 4-byte alignment
        const alignedSize = Math.max(4, Math.ceil(options.size / 4) * 4);
        const usage = options.usage | (options.data ? GPUBufferUsage.COPY_DST : 0);
        const label = options.label ?? "AwgpuBuffer";

        const gpuBuffer = device.createBuffer({
            label,
            size: alignedSize,
            usage,
        });

        const buf = new AwgpuBuffer(gpuBuffer, alignedSize, usage, { label });
        if (options.data) {
            buf.write(device, options.data);
        }
        return buf;
    }

    /**
     * Creates uniform buffer with automatic 16-byte minimum alignment.
     */
    static createUniform(
        device: GPUDevice,
        sizeOrData: number | AwgpuBufferData,
        label = "AwgpuUniformBuffer"
    ): AwgpuBuffer {
        const isData = typeof sizeOrData !== "number";
        const rawSize = isData ? (sizeOrData as ArrayBufferView).byteLength ?? (sizeOrData as ArrayBuffer).byteLength : (sizeOrData as number);
        // Minimum uniform size is 16 bytes, aligned to 16
        const size = Math.max(16, Math.ceil(rawSize / 16) * 16);
        return AwgpuBuffer.create(device, {
            size,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            data: isData ? (sizeOrData as AwgpuBufferData) : undefined,
            label,
        });
    }

    /**
     * Creates storage buffer with read-only or read-write usage.
     */
    static createStorage(
        device: GPUDevice,
        sizeOrData: number | AwgpuBufferData,
        options: { readOnly?: boolean; label?: string } = {}
    ): AwgpuBuffer {
        const isData = typeof sizeOrData !== "number";
        const rawSize = isData ? (sizeOrData as ArrayBufferView).byteLength ?? (sizeOrData as ArrayBuffer).byteLength : (sizeOrData as number);
        const size = Math.max(16, Math.ceil(rawSize / 4) * 4);
        const label = options.label ?? "AwgpuStorageBuffer";
        return AwgpuBuffer.create(device, {
            size,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            data: isData ? (sizeOrData as AwgpuBufferData) : undefined,
            label,
        });
    }

    /**
     * Creates vertex buffer with uploaded vertex data.
     */
    static createVertex(
        device: GPUDevice,
        dataOrSize: AwgpuBufferData | number,
        label = "AwgpuVertexBuffer"
    ): AwgpuBuffer {
        const isData = typeof dataOrSize !== "number";
        const rawSize = isData ? (dataOrSize as ArrayBufferView).byteLength ?? (dataOrSize as ArrayBuffer).byteLength : (dataOrSize as number);
        const size = Math.max(4, Math.ceil(rawSize / 4) * 4);
        return AwgpuBuffer.create(device, {
            size,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            data: isData ? (dataOrSize as AwgpuBufferData) : undefined,
            label,
        });
    }

    /**
     * Creates index buffer with uploaded index data.
     */
    static createIndex(
        device: GPUDevice,
        dataOrSize: AwgpuBufferData | number,
        label = "AwgpuIndexBuffer"
    ): AwgpuBuffer {
        const isData = typeof dataOrSize !== "number";
        const rawSize = isData ? (dataOrSize as ArrayBufferView).byteLength ?? (dataOrSize as ArrayBuffer).byteLength : (dataOrSize as number);
        const size = Math.max(4, Math.ceil(rawSize / 4) * 4);
        return AwgpuBuffer.create(device, {
            size,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            data: isData ? (dataOrSize as AwgpuBufferData) : undefined,
            label,
        });
    }
}

/**
 * Reusable GPU buffer pool for dynamic per-frame allocation without destruction thrashing.
 */
export class AwgpuBufferPool {
    private _available: AwgpuBuffer[] = [];
    private _inUse: AwgpuBuffer[] = [];
    readonly usage: GPUBufferUsageFlags;
    readonly label: string;

    constructor(usage: GPUBufferUsageFlags, label = "AwgpuBufferPool") {
        this.usage = usage;
        this.label = label;
    }

    /** Total number of allocated buffers currently managed by pool. */
    get totalBuffers(): number {
        return this._available.length + this._inUse.length;
    }

    /** Number of buffers currently acquired and active in frame. */
    get inUseCount(): number {
        return this._inUse.length;
    }

    /**
     * Resets active allocations at start of frame, returning all buffers to available pool.
     */
    reset(): void {
        const inUse = this._inUse;
        const available = this._available;
        for (let i = 0; i < inUse.length; i++) {
            available.push(inUse[i]);
        }
        inUse.length = 0;
    }

    /**
     * Acquires buffer with at least requested byte size using best-fit matching from available pool.
     */
    acquire(device: GPUDevice, requiredSize: number): AwgpuBuffer {
        const alignedSize = Math.max(16, Math.ceil(requiredSize / 16) * 16);

        let bestIndex = -1;
        let bestDiff = Number.POSITIVE_INFINITY;

        // Best-fit search among available buffers
        for (let i = 0; i < this._available.length; i++) {
            const buf = this._available[i];
            if (buf.size >= alignedSize) {
                const diff = buf.size - alignedSize;
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestIndex = i;
                    if (diff === 0) break;
                }
            }
        }

        if (bestIndex >= 0) {
            const lastIdx = this._available.length - 1;
            const buf = this._available[bestIndex];
            this._available[bestIndex] = this._available[lastIdx];
            this._available.pop();
            this._inUse.push(buf);
            return buf;
        }

        const id = this.totalBuffers;
        const newBuf = AwgpuBuffer.create(device, {
            size: alignedSize,
            usage: this.usage,
            label: `${this.label}_${id}`,
        });
        this._inUse.push(newBuf);
        return newBuf;
    }

    /**
     * Releases an individual buffer back to available pool ahead of frame reset.
     */
    release(buffer: AwgpuBuffer): boolean {
        const idx = this._inUse.indexOf(buffer);
        if (idx === -1) return false;
        const lastIdx = this._inUse.length - 1;
        this._inUse[idx] = this._inUse[lastIdx];
        this._inUse.pop();
        this._available.push(buffer);
        return true;
    }

    destroy(): void {
        for (const b of this._available) {
            b.destroy();
        }
        for (const b of this._inUse) {
            b.destroy();
        }
        this._available.length = 0;
        this._inUse.length = 0;
    }
}

