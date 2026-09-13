import type { ShaderCircuit } from "../assets/shader/circuit.js";
import type { Texture } from "../assets/texture.js";

/**
 * Pure data material component.
 * References ShaderCircuit and holds uniform parameters buffer and textures.
 */
export class MaterialCmp {
    circuit: ShaderCircuit;
    readonly uniformData: Float32Array;
    readonly textures: (Texture | null)[];
    isDirty: boolean;

    constructor(circuit: ShaderCircuit, initialUniforms?: Float32Array) {
        this.circuit = circuit;
        const { paramLayout } = circuit.buildParamLayout();
        this.uniformData = new Float32Array(paramLayout.defaultUniformData);
        if (initialUniforms) {
            this.uniformData.set(initialUniforms.subarray(0, this.uniformData.length));
        }
        this.textures = [];
        this.isDirty = true;
    }

    setParam(name: string, value: number[] | number): this {
        const { paramLayout } = this.circuit.buildParamLayout();
        const def = paramLayout.uniforms.get(name);
        if (!def) return this;

        const offset = def.byteOffset / 4;
        if (typeof value === "number") {
            this.uniformData[offset] = value;
        } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                this.uniformData[offset + i] = value[i];
            }
        }
        this.isDirty = true;
        return this;
    }

    setTexture(index: number, texture: Texture | null): this {
        this.textures[index] = texture;
        this.isDirty = true;
        return this;
    }
}
