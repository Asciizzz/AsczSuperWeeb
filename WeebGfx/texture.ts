/**
 * Pure CPU texture resource holding raw pixel data and dimensions.
 */
export class TextureCPU {
    width: number;
    height: number;
    format: string;
    pixels: ArrayBufferView;

    constructor(
        width: number,
        height: number,
        format: string,
        pixels: ArrayBufferView
    ) {
        this.width = width;
        this.height = height;
        this.format = format;
        this.pixels = pixels;
    }
}

/**
 * Base inheritable GPU texture resource representing shader data in general.
 * Decoupled from any specific graphics API. Subclasses implement hardware bindings.
 */
export class TextureGPU {
    width: number;
    height: number;
    format: string;
    cpu?: TextureCPU;

    constructor(
        width: number,
        height: number,
        format: string,
        cpu?: TextureCPU
    ) {
        this.width = width;
        this.height = height;
        this.format = format;
        this.cpu = cpu;
    }

    destroy(): void {
        // Base hook for hardware resource release
    }
}
