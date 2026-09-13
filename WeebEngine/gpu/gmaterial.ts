import {
    AwgpuBuffer,
    AwgpuBindSlot,
    AwgpuBindGroup,
    type AwgpuBindingEntry,
} from "../../Atoolkit/awgpu/index.js";
import type { ShaderParamLayout, TextureParamDef } from "../assets/shader/types.js";
import { GpuTexture } from "./gtexture.js";

let nextMaterialId = 0;

/**
 * GPU material parameters resource wrapper.
 * Manages material uniform buffer, bound textures, and slot 2 Material frequency bind group.
 */
export class GpuMaterial {
    readonly id: number;
    name: string;
    readonly layout: GPUBindGroupLayout;
    readonly paramLayout: ShaderParamLayout;
    readonly uniformBuffer: AwgpuBuffer;
    readonly uniformData: Float32Array;
    readonly textures: (GpuTexture | null)[];
    bindGroup: AwgpuBindGroup;
    private isDirty = false;

    constructor(
        layout: GPUBindGroupLayout,
        paramLayout: ShaderParamLayout,
        uniformBuffer: AwgpuBuffer,
        bindGroup: AwgpuBindGroup,
        textures: (GpuTexture | null)[] = [],
        name = "GpuMaterial"
    ) {
        this.id = ++nextMaterialId;
        this.name = name;
        this.layout = layout;
        this.paramLayout = paramLayout;
        this.uniformBuffer = uniformBuffer;
        this.uniformData = new Float32Array(paramLayout.defaultUniformData);
        this.bindGroup = bindGroup;
        this.textures = [...textures];
    }

    setParam(
        device: GPUDevice,
        name: string,
        value: number | number[] | Float32Array | GpuTexture
    ): this {
        if (value instanceof GpuTexture) {
            const texDef = this.paramLayout.textures.get(name);
            if (texDef) {
                this.textures[texDef.textureIndex] = value;
                this.rebuildBindGroup(device);
            }
            return this;
        }

        const uniformDef = this.paramLayout.uniforms.get(name);
        if (!uniformDef) return this;

        const floatOffset = uniformDef.byteOffset / 4;
        if (typeof value === "number") {
            this.uniformData[floatOffset] = value;
        } else if (Array.isArray(value) || value instanceof Float32Array) {
            this.uniformData.set(value, floatOffset);
        }

        this.uniformBuffer.write(device, this.uniformData);
        return this;
    }

    rebuildBindGroup(device: GPUDevice, defaultTexture?: GpuTexture): void {
        const fallbackTex = defaultTexture ?? GpuTexture.createSolid(device, 255, 255, 255, 255);
        const entries: AwgpuBindingEntry[] = [
            { binding: 0, resource: this.uniformBuffer },
        ];

        for (let i = 0; i < this.textures.length; i++) {
            const tex = this.textures[i] ?? fallbackTex;
            entries.push({ binding: 1 + i * 2, resource: tex.gpuView });
            entries.push({ binding: 2 + i * 2, resource: tex.gpuSampler });
        }

        this.bindGroup = AwgpuBindGroup.create(device, this.layout, entries, {
            slot: AwgpuBindSlot.Material,
            label: `${this.name}_MaterialBG`,
        });
    }

    destroy(): void {
        this.uniformBuffer.destroy();
    }
}
