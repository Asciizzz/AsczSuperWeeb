export interface TextureOptions {
    width: number;
    height: number;
    format?: GPUTextureFormat;
    label?: string;
}

/**
 * CPU texture data container.
 * Independent of GPU devices, handles pixel buffers or source bitmaps.
 */
export class Texture {
    readonly name: string;
    readonly width: number;
    readonly height: number;
    readonly format: GPUTextureFormat;
    readonly data: Uint8Array | Float32Array;

    constructor(
        name: string,
        data: Uint8Array | Float32Array,
        options: TextureOptions
    ) {
        this.name = name;
        this.data = data;
        this.width = options.width;
        this.height = options.height;
        this.format = options.format ?? "rgba8unorm";
    }

    static createSolid(name = "SolidColor", r = 255, g = 255, b = 255, a = 255): Texture {
        const pixelData = new Uint8Array([r, g, b, a]);
        return new Texture(name, pixelData, { width: 1, height: 1, format: "rgba8unorm" });
    }
}
