import {
    AwgpuPass,
    AwgpuBindGroup,
    AwgpuBuffer,
    AwgpuRenderPipeline,
} from "../../Atoolkit/awgpu/index.js";
import type { GfxTechnique } from "./technique.js";

export interface MotionGfxRecordParams {
    passBindGroup: AwgpuBindGroup;
    bgPipeline?: AwgpuRenderPipeline;
    particles?: {
        pipeline: AwgpuRenderPipeline;
        quadVertexBuffer: AwgpuBuffer;
        quadIndexBuffer: AwgpuBuffer;
        instanceBuffer: AwgpuBuffer;
        indexCount: number;
        instanceCount: number;
    };
}

/**
 * 2D and pseudo-2D mixed motion graphics rendering technique.
 * Encapsulates fullscreen background sweeps, kinetic audio ripples, and instanced vector billboards.
 */
export class MotionGfxTechnique implements GfxTechnique {
    readonly name = "MotionGfxTechnique";

    record(pass: AwgpuPass, params: MotionGfxRecordParams): void {
        // 1. Draw procedural background if configured
        if (params.bgPipeline) {
            pass.addDraw({
                pipeline: params.bgPipeline,
                vertexCount: 3,
                bindGroups: [params.passBindGroup],
            });
        }

        // 2. Draw 2D instanced vector particles
        if (params.particles && params.particles.instanceCount > 0) {
            const p = params.particles;
            pass.addDraw({
                pipeline: p.pipeline,
                vertexBuffer: [p.quadVertexBuffer, p.instanceBuffer],
                indexBuffer: p.quadIndexBuffer,
                indexFormat: "uint16",
                indexCount: p.indexCount,
                instanceCount: p.instanceCount,
                bindGroups: [params.passBindGroup],
            });
        }
    }
}
