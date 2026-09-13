export interface MeshAttributeDesc {
    name: string;
    format: GPUVertexFormat;
    offset?: number;
}

export interface SubmeshDesc {
    name: string;
    indexStart: number;
    indexCount: number;
    materialSlot?: number;
    visible?: boolean;
}

/**
 * CPU geometry asset container.
 * Stores raw vertex array, index array, and flexible attribute descriptors.
 * Hardware-agnostic; operates in worker threads or headless environments.
 */
export class Mesh {
    readonly name: string;
    readonly vertexData: Float32Array;
    readonly indexData: Uint16Array | Uint32Array;
    readonly attributes: MeshAttributeDesc[];
    readonly submeshes: SubmeshDesc[];

    constructor(
        name: string,
        vertexData: Float32Array,
        indexData: Uint16Array | Uint32Array,
        attributes?: MeshAttributeDesc[],
        submeshes?: SubmeshDesc[]
    ) {
        this.name = name;
        this.vertexData = vertexData;
        this.indexData = indexData;

        // Default to standard 3D layout: Position(3), Normal(3), UV(2) = 32 bytes stride
        this.attributes = attributes ?? [
            { name: "position", format: "float32x3" },
            { name: "normal", format: "float32x3" },
            { name: "uv", format: "float32x2" },
        ];

        this.submeshes = submeshes ?? [
            {
                name: "default",
                indexStart: 0,
                indexCount: indexData.length,
                materialSlot: 0,
                visible: true,
            },
        ];
    }

    get isIndex32(): boolean {
        return this.indexData instanceof Uint32Array;
    }

    get totalIndices(): number {
        return this.indexData.length;
    }

    get vertexCount(): number {
        let stride = 0;
        for (const attr of this.attributes) {
            if (attr.format === "float32x3") stride += 3;
            else if (attr.format === "float32x2") stride += 2;
            else if (attr.format === "float32x4") stride += 4;
            else if (attr.format === "float32") stride += 1;
            else stride += 1;
        }
        return stride > 0 ? Math.floor(this.vertexData.length / stride) : 0;
    }
}
