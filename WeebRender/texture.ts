let textureIdCounter = 0;

/**
 * Static Texture asset container.
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
