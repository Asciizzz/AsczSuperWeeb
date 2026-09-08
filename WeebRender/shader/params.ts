import { Acmp } from "../../Atoolkit/acmp/index.js";
import type { GShader } from "../gpu.js";
import type { ShaderParamRecord, ShaderParamValue } from "../shadercmp.js";

/**
 * Runtime component holding parameter overrides for an entity's shader.
 * If omitted on an entity, submeshes render using their shader's default parameters.
 */
export class ShaderParamsCmp extends Acmp {
    rShader?: GShader;
    values: ShaderParamRecord;

    constructor(
        values: ShaderParamRecord = {},
        rShader?: GShader
    ) {
        super();
        this.values = values;
        this.rShader = rShader;
    }

    set(paramName: string, value: ShaderParamValue): this {
        this.values[paramName] = value;
        return this;
    }

    get(paramName: string): ShaderParamValue | undefined {
        return this.values[paramName];
    }
}
