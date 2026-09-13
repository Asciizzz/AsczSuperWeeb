import {
    AwgpuDevice,
    AwgpuRenderTarget,
    AwgpuPass,
    AwgpuFrame,
} from "../../Atoolkit/awgpu/index.js";

export interface GfxComposerOptions {
    depthFormat?: GPUTextureFormat | null;
    clearColor?: { r: number; g: number; b: number; a: number };
}

/**
 * Declarative frame orchestrator scheduling passes and techniques onto hardware targets.
 */
export class GfxComposer {
    readonly device: AwgpuDevice;
    readonly screenTarget: AwgpuRenderTarget;

    constructor(device: AwgpuDevice, options: GfxComposerOptions = {}) {
        this.device = device;
        const depthFormat = options.depthFormat === null ? null : (options.depthFormat ?? "depth24plus");

        this.screenTarget = AwgpuRenderTarget.createScreen(device, {
            depthFormat,
            clearColor: options.clearColor ?? { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
        });
    }

    createPass(name = "RenderPass", target?: AwgpuRenderTarget): AwgpuPass {
        return new AwgpuPass(name, target ?? this.screenTarget);
    }

    execute(passes: AwgpuPass | AwgpuPass[]): void {
        const frame = new AwgpuFrame();
        if (Array.isArray(passes)) {
            for (const pass of passes) {
                frame.addPass(pass);
            }
        } else {
            frame.addPass(passes);
        }
        frame.execute(this.device);
    }

    resize(): void {
        if (this.device.canvas) {
            this.screenTarget.resize(
                this.device.device,
                this.device.canvas.width,
                this.device.canvas.height
            );
        }
    }
}
