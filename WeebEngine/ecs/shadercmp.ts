import { GpuShader } from "../gpu/gshader.js";
import { GpuMaterial } from "../gpu/gmaterial.js";

/**
 * Shader and Material ECS Component.
 * Holds direct references to GPU pipeline and material bind group handles.
 */
export class ShaderCmp {
    readonly rShader: GpuShader;
    readonly materials: (GpuMaterial | null)[];

    constructor(
        rShader: GpuShader,
        materials: (GpuMaterial | null)[] | GpuMaterial
    ) {
        this.rShader = rShader;
        if (Array.isArray(materials)) {
            this.materials = [...materials];
        } else {
            this.materials = [materials];
        }
    }

    getMaterial(slot = 0): GpuMaterial | null {
        return this.materials[slot] ?? null;
    }

    setMaterial(slot: number, mat: GpuMaterial | null): this {
        this.materials[slot] = mat;
        return this;
    }

    setParam(
        device: GPUDevice,
        name: string,
        value: any,
        slot = 0
    ): this {
        const mat = this.getMaterial(slot);
        if (mat) {
            mat.setParam(device, name, value);
        }
        return this;
    }
}
