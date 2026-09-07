import { Acmp } from "../Atoolkit/acmp/index.js";
import type { GTexture } from "./wgpu/gtexture.js";
import type { GShader } from "./wgpu/gshader.js";

export type MaterialParamValue = number | number[] | Float32Array | GTexture | null;
export type MaterialParamRecord = Record<string, MaterialParamValue>;

export interface MaterialSlot {
    shader?: GShader;
    params?: MaterialParamRecord | null;
}

/**
 * ECS component holding shader references (GShader) and parameter overrides per slot.
 */
export class MaterialCmp extends Acmp {
    shaders: (GShader | null)[];
    params: (MaterialParamRecord | null)[];

    constructor(
        shaders: (GShader | null)[] | GShader = [],
        params: (MaterialParamRecord | null)[] | MaterialParamRecord = []
    ) {
        super();
        if (Array.isArray(shaders)) {
            this.shaders = [...shaders];
        } else if (shaders) {
            this.shaders = [shaders];
        } else {
            this.shaders = [];
        }

        if (Array.isArray(params)) {
            this.params = [...params];
        } else if (params && typeof params === "object") {
            this.params = [{ ...params }];
        } else {
            this.params = [];
        }
    }

    /**
     * Gets the shader assigned to a slot.
     */
    getShader(slot = 0): GShader | null | undefined {
        return this.shaders[slot];
    }

    /**
     * Assigns a shader to a slot.
     */
    setShader(slot: number, shader: GShader | null): this {
        this.shaders[slot] = shader;
        return this;
    }

    /**
     * Sets a parameter override value for a slot.
     */
    setParam(slot: number, paramName: string, value: MaterialParamValue): this {
        if (!this.params[slot]) {
            this.params[slot] = {};
        }
        this.params[slot]![paramName] = value;
        return this;
    }

    /**
     * Gets a parameter override value for a slot.
     */
    getParam(slot: number, paramName: string): MaterialParamValue | undefined {
        return this.params[slot]?.[paramName];
    }

    /**
     * Sets multiple parameter overrides on a slot.
     */
    setParams(slot: number, values: MaterialParamRecord): this {
        if (!this.params[slot]) {
            this.params[slot] = {};
        }
        Object.assign(this.params[slot]!, values);
        return this;
    }

    /**
     * Gets all parameter overrides for a slot.
     */
    getParams(slot = 0): MaterialParamRecord | null | undefined {
        return this.params[slot];
    }
}
