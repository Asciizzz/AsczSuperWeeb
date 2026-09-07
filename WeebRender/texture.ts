let textureIdCounter = 0;

/**
 * Pure CPU Texture asset data container.
 * Completely backend-agnostic: holds image dimensions and raw pixel byte buffer.
 */
export class Texture {
    readonly id: number;
    name: string;
    width: number;
    height: number;
    data: Uint8Array | null;

    constructor(
        name = "Texture",
        width = 1,
        height = 1,
        data: Uint8Array | null = null
    ) {
        this.id = ++textureIdCounter;
        this.name = name;
        this.width = width;
        this.height = height;
        this.data = data;
    }
}
