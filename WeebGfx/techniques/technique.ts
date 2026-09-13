import type { AwgpuPass } from "../../Atoolkit/awgpu/index.js";

/**
 * Base contract for rendering techniques.
 * A technique is an independent execution strategy operating on whatever ComponentSets or buffers it requires.
 */
export interface GfxTechnique {
    readonly name: string;
    record(pass: AwgpuPass, ...args: any[]): void;
}
