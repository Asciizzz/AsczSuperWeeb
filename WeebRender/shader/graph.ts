import { Adataflow, type Awire } from "../../Atoolkit/adataflow/index.js";
import { Adiag } from "../../Atoolkit/adiag/index.js";
import {
    ShaderNode,
    OutputNode,
    ColorNode,
    FloatNode,
    TextureSampleNode,
    ParamVec4Node,
    ParamFloatNode,
    isShaderParam,
    type NodeCompileContext,
} from "./nodes.js";
import type {
    SocketType,
    ShaderParamLayout,
    UniformParamDef,
    TextureParamDef,
} from "./types.js";
import type { Texture } from "../texture.js";
import type { ShaderProcessCtx } from "./nodes.js";

export interface CompiledShaderBlueprint {
    name: string;
    wgsl: string;
    wgslSkinned?: string;
    getWgsl?: (skinned: boolean) => string;
    paramLayout: ShaderParamLayout;
    textureNodes: TextureSampleNode[];
    orderedNodes: ShaderNode[];
    skinned: boolean;
    cullMode?: GPUCullMode;
    topology?: GPUPrimitiveTopology;
}

/**
 * Directed acyclic graph of shader micro-nodes connected via typed sockets.
 * Extends the generic Adataflow computation graph, specializing it for WebGPU WGSL generation
 * and uniform buffer memory layouts.
 */
export class ShaderGraph extends Adataflow {
    readonly name: string;
    readonly diag: Adiag;
    private _lastOutputNode: OutputNode;

    constructor(name = "ShaderGraph", diag?: Adiag) {
        super({ label: name });
        this.name = name;
        this.diag = diag ?? new Adiag();
        this._lastOutputNode = new OutputNode(`${name}_Output`);
        super.addNode(this._lastOutputNode);
    }

    get outputNode(): OutputNode {
        for (const node of this.nodes.values()) {
            if (node instanceof OutputNode) {
                this._lastOutputNode = node;
                return node;
            }
        }
        return this._lastOutputNode;
    }

    override addNode(node: ShaderNode): this {
        if (node instanceof OutputNode && node !== this.outputNode) {
            const currentOut = this.outputNode;
            if (currentOut && this.hasNode(currentOut.id)) {
                const inWires = this.getIncomingWires(currentOut.id);
                if (inWires.length === 0) {
                    this.removeNode(currentOut.id);
                }
            }
            this._lastOutputNode = node;
        }
        return super.addNode(node);
    }

    /**
     * Compiles the node graph into WGSL shader code and precomputes uniform layouts.
     * Validates parameter name uniqueness across uniform nodes and texture sample nodes.
     * Returns null and records diagnostic errors if duplicate parameter names are encountered.
     */
    compile(options: {
        target?: string;
        meta?: Record<string, unknown>;
        skinned?: boolean;
        cullMode?: GPUCullMode;
        topology?: GPUPrimitiveTopology;
        diag?: Adiag;
    } = {}): CompiledShaderBlueprint | null {
        const skinned = !!options.skinned;
        const diag = options.diag ?? this.diag;
        diag.clear();

        // 1. Topological Sort via Adataflow
        const sortedNodes = this.topoSort() as ShaderNode[];

        // 2. Validate Parameter Name Uniqueness Across All Nodes
        const seenParams = new Map<string, ShaderNode>();
        let hasDuplicate = false;

        for (const node of sortedNodes) {
            let pName: string | undefined;
            if (node instanceof TextureSampleNode) {
                pName = node.paramName ?? node.id;
            } else if (isShaderParam(node) && node.paramName) {
                pName = node.paramName;
            }

            if (pName) {
                const existing = seenParams.get(pName);
                if (existing) {
                    diag.err({
                        code: "ERR_DUPLICATE_SHADER_PARAM",
                        raw: `Duplicate parameter name "${pName}" on node "${node.id}" (conflicts with node "${existing.id}")`,
                        data: {
                            paramName: pName,
                            conflictingNodeId: node.id,
                            existingNodeId: existing.id,
                        },
                    });
                    hasDuplicate = true;
                } else {
                    seenParams.set(pName, node);
                }
            }
        }

        if (hasDuplicate) {
            return null;
        }

        // 3. Identify All Parameters and Textures
        const uniformsMap = new Map<string, UniformParamDef>();
        const texturesMap = new Map<string, TextureParamDef>();
        const textureNodes: TextureSampleNode[] = [];

        let currentByteOffset = 0;

        for (const node of sortedNodes) {
            if (node instanceof TextureSampleNode) {
                const texIdx = textureNodes.length;
                node.textureIndex = texIdx;
                textureNodes.push(node);

                const paramName = node.paramName ?? node.id;
                texturesMap.set(paramName, {
                    name: paramName,
                    bindingIndex: 1 + texIdx * 2, // texture at 1 + 2*i, sampler at 2 + 2*i (0 is uMaterial)
                    defaultTexture: node.defaultTexture,
                });
            } else if (isShaderParam(node) && node.paramName) {
                if (node instanceof ColorNode || node instanceof ParamVec4Node) {
                    // Align to 16 bytes
                    currentByteOffset = Math.ceil(currentByteOffset / 16) * 16;
                    uniformsMap.set(node.paramName, {
                        name: node.paramName,
                        type: "vec4",
                        byteOffset: currentByteOffset,
                        sizeBytes: 16,
                        defaultValue: [...node.defaultColor],
                    });
                    currentByteOffset += 16;
                } else if (node instanceof FloatNode || node instanceof ParamFloatNode) {
                    // Align to 4 bytes
                    currentByteOffset = Math.ceil(currentByteOffset / 4) * 4;
                    uniformsMap.set(node.paramName, {
                        name: node.paramName,
                        type: "float",
                        byteOffset: currentByteOffset,
                        sizeBytes: 4,
                        defaultValue: node.defaultValue,
                    });
                    currentByteOffset += 4;
                }
            }
        }

        // Align total uniform buffer size to 16-byte boundary (WebGPU uniform buffer requirement)
        const totalUniformBytes = Math.max(16, Math.ceil(currentByteOffset / 16) * 16);
        const defaultUniformData = new Float32Array(totalUniformBytes / 4);

        // Populate default values into defaultUniformData
        for (const def of uniformsMap.values()) {
            const floatOffset = def.byteOffset / 4;
            if (def.type === "vec4" && Array.isArray(def.defaultValue)) {
                defaultUniformData.set(def.defaultValue, floatOffset);
            } else if (def.type === "float" && typeof def.defaultValue === "number") {
                defaultUniformData[floatOffset] = def.defaultValue;
            }
        }

        const paramLayout: ShaderParamLayout = {
            uniforms: uniformsMap,
            textures: texturesMap,
            totalUniformBytes,
            defaultUniformData,
        };

        // 3. Execute dataflow run to process nodes and collect WGSL statements
        const statements: string[] = [];
        this.run<ShaderProcessCtx>({
            ctx: { statements, uniformVarName: "uMaterial" },
        });

        // 4. Assemble WGSL shader for both static and skinned vertex configurations
        const wgslStatic = this.assembleWGSL(paramLayout, textureNodes, statements, false);
        const wgslSkinned = this.assembleWGSL(paramLayout, textureNodes, statements, true);
        const getWgsl = (isSkinned: boolean) => isSkinned ? wgslSkinned : wgslStatic;
        const defaultWgsl = skinned ? wgslSkinned : wgslStatic;

        return {
            name: this.name,
            wgsl: defaultWgsl,
            wgslSkinned,
            getWgsl,
            paramLayout,
            textureNodes,
            orderedNodes: sortedNodes,
            skinned: options.skinned ?? true,
            cullMode: options.cullMode,
            topology: options.topology,
        };
    }

    private assembleWGSL(
        paramLayout: ShaderParamLayout,
        textureNodes: TextureSampleNode[],
        statements: string[],
        skinned = false
    ): string {
        // Material Uniforms Struct in Group 2 Binding 0
        const fields: string[] = [];
        for (const u of paramLayout.uniforms.values()) {
            if (u.type === "vec4") {
                fields.push(`    ${u.name}: vec4<f32>,`);
            } else if (u.type === "float") {
                fields.push(`    ${u.name}: f32,`);
            }
        }
        if (fields.length === 0) {
            fields.push("    _dummy: vec4<f32>,");
        }

        const materialStructWGSL = `
            struct MaterialUniforms {
            ${fields.join("\n")}
        };`;
        const materialBindingWGSL = `@group(2) @binding(0) var<uniform> uMaterial: MaterialUniforms;`;

        const skinBindingWGSL = skinned
            ? `@group(3) @binding(0) var<storage, read> uBones: array<mat4x4<f32>>;`
            : "";

        // Texture Bindings at @group(2) starting at binding 1
        const textureBindingsWGSL: string[] = [];
        for (let i = 0; i < textureNodes.length; i++) {
            textureBindingsWGSL.push(
                `@group(2) @binding(${1 + i * 2}) var t_tex_${i}: texture_2d<f32>;\n` +
                `@group(2) @binding(${2 + i * 2}) var s_tex_${i}: sampler;`
            );
        }

        const vertexInputWGSL = skinned
            ? `struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) joints: vec4<u32>,
    @location(4) weights: vec4<f32>,
};`
            : `struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};`;

        const vsBodyWGSL = skinned
            ? `    var out: VertexOutput;
    let skinMat =
        in.weights.x * uBones[in.joints.x] +
        in.weights.y * uBones[in.joints.y] +
        in.weights.z * uBones[in.joints.z] +
        in.weights.w * uBones[in.joints.w];
    let localSkinnedPos = skinMat * vec4<f32>(in.position, 1.0);
    let worldPos4 = uObject.model * localSkinnedPos;
    out.worldPos = worldPos4.xyz;
    out.clipPos = uCamera.viewProj * worldPos4;
    let localSkinnedNorm = (skinMat * vec4<f32>(in.normal, 0.0)).xyz;
    out.normal = normalize((uObject.model * vec4<f32>(localSkinnedNorm, 0.0)).xyz);
    out.uv = in.uv;
    return out;`
            : `    var out: VertexOutput;
    let worldPos4 = uObject.model * vec4<f32>(in.position, 1.0);
    out.worldPos = worldPos4.xyz;
    out.clipPos = uCamera.viewProj * worldPos4;
    out.normal = normalize((uObject.model * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv = in.uv;
    return out;`;

        // Fragment Body statements from dataflow run
        const fragmentCodeLines = statements;

        return /* wgsl */ `
struct CameraUniforms {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
};

struct ObjectUniforms {
    model: mat4x4<f32>,
};

${materialStructWGSL}

@group(0) @binding(0) var<uniform> uCamera: CameraUniforms;
@group(1) @binding(0) var<uniform> uObject: ObjectUniforms;
${materialBindingWGSL}
${skinBindingWGSL}

${textureBindingsWGSL.join("\n")}

${vertexInputWGSL}

struct VertexOutput {
    @builtin(position) clipPos: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
${vsBodyWGSL}
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var finalSurfaceColor: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0);
${fragmentCodeLines.join("\n")}

    return finalSurfaceColor;
}
`;
    }
}
