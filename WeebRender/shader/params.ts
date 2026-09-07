import { Acmp } from "../../Atoolkit/acmp/index.js";
import type { Texture } from "../texture.js";
import type { GShader } from "../wgpu/gshader.js";
import type { MaterialParamRecord, MaterialParamValue } from "../material.js";

/**
 * Runtime component holding parameter overrides for an entity's shader.
 * If omitted on an entity, submeshes render using their shader's default parameters.
 */
export class ShaderParamsCmp extends Acmp {
    rShader?: GShader;
    values: MaterialParamRecord;

    constructor(
        values: MaterialParamRecord = {},
        rShader?: GShader
    ) {
        super();
        this.values = values;
        this.rShader = rShader;
    }

    set(paramName: string, value: MaterialParamValue): this {
        this.values[paramName] = value;
        return this;
    }

    get(paramName: string): MaterialParamValue | undefined {
        return this.values[paramName];
    }
}

