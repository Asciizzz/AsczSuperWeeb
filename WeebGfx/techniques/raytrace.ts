import { AwgpuPass, AwgpuBindGroup, AwgpuRenderPipeline } from "../../Atoolkit/awgpu/index.js";
import type { GfxTechnique } from "./technique.js";

export interface RayTraceRecordParams {
    pipeline: AwgpuRenderPipeline;
    passBindGroup: AwgpuBindGroup;  // Slot 0
    sceneBindGroup: AwgpuBindGroup; // Slot 3
}

/**
 * Screen-space / compute ray tracing technique executing via fullscreen pass.
 */
export class RayTraceTechnique implements GfxTechnique {
    readonly name = "RayTraceTechnique";

    record(pass: AwgpuPass, params: RayTraceRecordParams): void {
        pass.addDraw({
            pipeline: params.pipeline,
            vertexCount: 3, // Fullscreen triangle
            bindGroups: [params.passBindGroup, null, null, params.sceneBindGroup],
        });
    }
}
