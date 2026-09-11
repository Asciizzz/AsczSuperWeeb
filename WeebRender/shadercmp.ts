import type { GpuTexture, GpuShader } from "./gpu.js";

export type ShaderParamValue = number | number[] | Float32Array | GpuTexture | null;
export type ShaderParamRecord = Record<string, ShaderParamValue>;

export interface ShaderSlot {
    shader?: GpuShader;
    params?: ShaderParamRecord | null;
}

/**
 * ECS component holding shader references (GpuShader) and parameter overrides per slot.
 */
export class ShaderCmp {
    shaders: (GpuShader | null)[];
    params: (ShaderParamRecord | null)[];

    constructor(
        shaders: (GpuShader | null)[] | GpuShader = [],
        params: (ShaderParamRecord | null)[] | ShaderParamRecord = []
    ) {
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
    getShader(slot = 0): GpuShader | null | undefined {
        return this.shaders[slot];
    }

    /**
     * Assigns a shader to a slot.
     */
    setShader(slot: number, shader: GpuShader | null): this {
        this.shaders[slot] = shader;
        return this;
    }

    /**
     * Sets a parameter override value for a slot.
     */
    setParam(slot: number, paramName: string, value: ShaderParamValue): this {
        if (!this.params[slot]) {
            this.params[slot] = {};
        }
        this.params[slot]![paramName] = value;
        return this;
    }

    /**
     * Gets a parameter override value for a slot.
     */
    getParam(slot: number, paramName: string): ShaderParamValue | undefined {
        return this.params[slot]?.[paramName];
    }

    /**
     * Sets multiple parameter overrides on a slot.
     */
    setParams(slot: number, values: ShaderParamRecord): this {
        if (!this.params[slot]) {
            this.params[slot] = {};
        }
        Object.assign(this.params[slot]!, values);
        return this;
    }

    /**
     * Gets all parameter overrides for a slot.
     */
    getParams(slot = 0): ShaderParamRecord | null | undefined {
        return this.params[slot];
    }
}
