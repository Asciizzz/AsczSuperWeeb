let nextTextureId = 0;

/**
 * Pure CPU Texture asset container.
 * Stores raw byte data and dimensions independent of GPU textures.
 */
export class Texture {
    readonly id: number;
    name: string;
    width: number;
    height: number;
    data: Uint8Array;
    format: "rgba8unorm" | "rgba8unorm-srgb";

    constructor(
        name = "Texture",
        width = 1,
        height = 1,
        data?: Uint8Array,
        format: "rgba8unorm" | "rgba8unorm-srgb" = "rgba8unorm"
    ) {
        this.id = ++nextTextureId;
        this.name = name;
        this.width = width;
        this.height = height;
        this.data = data ?? new Uint8Array([255, 255, 255, 255]);
        this.format = format;
    }

    static createSolid(r: number, g: number, b: number, a = 255): Texture {
        return new Texture("SolidColor", 1, 1, new Uint8Array([r, g, b, a]));
    }
}
