import type { AwgpuRenderTarget } from "./target.js";
import type { AwgpuRenderPipeline, AwgpuComputePipeline } from "./pipeline.js";
import type { AwgpuBindGroup } from "./layout.js";
import type { AwgpuBuffer } from "./buffer.js";

export interface AwgpuDrawCommand {
    pipeline: AwgpuRenderPipeline;
    vertexBuffer: GPUBuffer | AwgpuBuffer | (GPUBuffer | AwgpuBuffer)[];
    indexBuffer?: GPUBuffer | AwgpuBuffer;
    indexFormat?: GPUIndexFormat;
    indexCount?: number;
    vertexCount?: number;
    indexStart?: number;
    vertexStart?: number;
    instanceCount?: number;
    firstInstance?: number;
    bindGroups?: (GPUBindGroup | AwgpuBindGroup | null | undefined)[];
}

export interface AwgpuComputeCommand {
    pipeline: AwgpuComputePipeline;
    workgroupsX: number;
    workgroupsY?: number;
    workgroupsZ?: number;
    bindGroups?: (GPUBindGroup | AwgpuBindGroup | null | undefined)[];
}

function resolveGpuBuffer(buf: GPUBuffer | AwgpuBuffer): GPUBuffer {
    return "gpuBuffer" in buf ? buf.gpuBuffer : buf;
}

function resolveGpuBindGroup(bg: GPUBindGroup | AwgpuBindGroup | null | undefined): GPUBindGroup | null {
    if (!bg) return null;
    return "gpuBindGroup" in bg ? bg.gpuBindGroup : bg;
}

/**
 * Encapsulates self-contained WebGPU render pass recording draw commands into target.
 */
export class AwgpuPass {
    readonly name: string;
    target: AwgpuRenderTarget;
    viewport?: { x: number; y: number; width: number; height: number; minDepth?: number; maxDepth?: number };
    scissor?: { x: number; y: number; width: number; height: number };
    drawCommands: AwgpuDrawCommand[] = [];

    constructor(name: string, target: AwgpuRenderTarget) {
        this.name = name;
        this.target = target;
    }

    addDraw(cmd: AwgpuDrawCommand): this {
        this.drawCommands.push(cmd);
        return this;
    }

    clearDraws(): void {
        this.drawCommands.length = 0;
    }

    /**
     * Records render pass into active command encoder with redundant state filtering.
     */
    execute(encoder: GPUCommandEncoder): void {
        const passDesc = this.target.buildPassDescriptor();
        passDesc.label = `${this.name}_Encoder`;
        const pass = encoder.beginRenderPass(passDesc);

        if (this.viewport) {
            pass.setViewport(
                this.viewport.x,
                this.viewport.y,
                this.viewport.width,
                this.viewport.height,
                this.viewport.minDepth ?? 0.0,
                this.viewport.maxDepth ?? 1.0
            );
        }

        if (this.scissor) {
            pass.setScissorRect(
                this.scissor.x,
                this.scissor.y,
                this.scissor.width,
                this.scissor.height
            );
        }

        // Redundant state filtering cache
        let activePipeline: GPURenderPipeline | null = null;
        let activeIbo: GPUBuffer | null = null;
        const activeVbos: (GPUBuffer | null)[] = [];
        const activeBindGroups: (GPUBindGroup | null)[] = [null, null, null, null];

        for (let i = 0; i < this.drawCommands.length; i++) {
            const cmd = this.drawCommands[i];

            // 1. Pipeline State
            if (activePipeline !== cmd.pipeline.gpuPipeline) {
                pass.setPipeline(cmd.pipeline.gpuPipeline);
                activePipeline = cmd.pipeline.gpuPipeline;
            }

            // 2. Bind Groups (Slots 0 to 3)
            if (cmd.bindGroups) {
                for (let slot = 0; slot < cmd.bindGroups.length; slot++) {
                    const bg = resolveGpuBindGroup(cmd.bindGroups[slot]);
                    if (bg && activeBindGroups[slot] !== bg) {
                        pass.setBindGroup(slot, bg);
                        activeBindGroups[slot] = bg;
                    }
                }
            }

            // 3. Vertex Buffers
            if (Array.isArray(cmd.vertexBuffer)) {
                for (let vSlot = 0; vSlot < cmd.vertexBuffer.length; vSlot++) {
                    const vbo = resolveGpuBuffer(cmd.vertexBuffer[vSlot]);
                    if (activeVbos[vSlot] !== vbo) {
                        pass.setVertexBuffer(vSlot, vbo);
                        activeVbos[vSlot] = vbo;
                    }
                }
            } else {
                const vbo = resolveGpuBuffer(cmd.vertexBuffer);
                if (activeVbos[0] !== vbo) {
                    pass.setVertexBuffer(0, vbo);
                    activeVbos[0] = vbo;
                }
            }

            // 4. Index Buffer & Draw Execution
            const instanceCount = cmd.instanceCount ?? 1;
            const firstInstance = cmd.firstInstance ?? 0;

            if (cmd.indexBuffer) {
                const ibo = resolveGpuBuffer(cmd.indexBuffer);
                const format = cmd.indexFormat ?? "uint16";
                if (activeIbo !== ibo) {
                    pass.setIndexBuffer(ibo, format);
                    activeIbo = ibo;
                }
                const count = cmd.indexCount ?? 0;
                const start = cmd.indexStart ?? 0;
                if (count > 0) {
                    pass.drawIndexed(count, instanceCount, start, 0, firstInstance);
                }
            } else if (cmd.vertexCount !== undefined && cmd.vertexCount > 0) {
                pass.draw(cmd.vertexCount, instanceCount, cmd.vertexStart ?? 0, firstInstance);
            }
        }

        pass.end();
    }
}

/**
 * Encapsulates WebGPU compute pass executing compute dispatch commands.
 */
export class AwgpuComputePass {
    readonly name: string;
    commands: AwgpuComputeCommand[] = [];

    constructor(name: string) {
        this.name = name;
    }

    addCompute(cmd: AwgpuComputeCommand): this {
        this.commands.push(cmd);
        return this;
    }

    clear(): void {
        this.commands.length = 0;
    }

    execute(encoder: GPUCommandEncoder): void {
        const pass = encoder.beginComputePass({ label: `${this.name}_Encoder` });
        let activePipeline: GPUComputePipeline | null = null;
        const activeBindGroups: (GPUBindGroup | null)[] = [null, null, null, null];

        for (const cmd of this.commands) {
            if (activePipeline !== cmd.pipeline.gpuPipeline) {
                pass.setPipeline(cmd.pipeline.gpuPipeline);
                activePipeline = cmd.pipeline.gpuPipeline;
            }

            if (cmd.bindGroups) {
                for (let slot = 0; slot < cmd.bindGroups.length; slot++) {
                    const bg = resolveGpuBindGroup(cmd.bindGroups[slot]);
                    if (bg && activeBindGroups[slot] !== bg) {
                        pass.setBindGroup(slot, bg);
                        activeBindGroups[slot] = bg;
                    }
                }
            }

            pass.dispatchWorkgroups(
                cmd.workgroupsX,
                cmd.workgroupsY ?? 1,
                cmd.workgroupsZ ?? 1
            );
        }

        pass.end();
    }
}
