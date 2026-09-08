import { Acircuit } from "../../Atoolkit/acircuit/index.js";
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
} from "./nodes.js";
import type {
    ShaderParamLayout,
    UniformParamDef,
    TextureParamDef,
    CompiledTextureNode,
} from "./types.js";


export interface CompiledShaderBlueprint {
    name: string;
    code: string;
    codeSkinned?: string;
    getCode?: (skinned: boolean) => string;
    paramLayout: ShaderParamLayout;
    textureNodes: CompiledTextureNode[];
    orderedNodes: ShaderNode[];
    skinned: boolean;
    cullMode?: "none" | "front" | "back";
    topology?: "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";
}

export type ShaderCompiler<TOptions = any> = (
    graph: ShaderGraph,
    options?: TOptions
) => CompiledShaderBlueprint | null;

/**
 * Directed acyclic graph of shader micro-nodes connected via typed sockets.
 * Extends the generic Acircuit computation graph, purely representing shader AST topology
 * and uniform buffer memory layouts without binding to any specific graphics API or shading language.
 */
export class ShaderGraph extends Acircuit {
    static defaultCompiler?: ShaderCompiler;

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
     * Finds all nodes that have a directed path to the output node (upstream contributing nodes).
     * Disconnected nodes with no path to the output node are excluded.
     */
    getContributingNodes(): Set<ShaderNode> {
        const contributing = new Set<ShaderNode>();
        const outNode = this.outputNode;
        if (!outNode || !this.hasNode(outNode.id)) {
            return contributing;
        }

        const visited = new Set<string>();
        const queue: string[] = [outNode.id];
        visited.add(outNode.id);

        while (queue.length > 0) {
            const currId = queue.shift()!;
            const inWires = this.getIncomingWires(currId);
            for (const wire of inWires) {
                if (!visited.has(wire.outNodeId)) {
                    visited.add(wire.outNodeId);
                    queue.push(wire.outNodeId);
                }
            }
        }

        for (const id of visited) {
            const node = this.nodes.get(id);
            if (node instanceof ShaderNode) {
                contributing.add(node);
            }
        }
        return contributing;
    }

    /**
     * Topologically sorts only the active nodes that contribute to the shader output.
     * Dead / disconnected nodes are pruned.
     */
    getExecutableNodes(): ShaderNode[] {
        const contributing = this.getContributingNodes();
        const allSorted = this.topoSort() as ShaderNode[];
        return allSorted.filter((n) => contributing.has(n));
    }

    /**
     * Validates that parameter names across uniform nodes and texture sample nodes are unique.
     * Records diagnostic errors if duplicates are encountered.
     */
    validateParams(diag?: Adiag): boolean {
        const d = diag ?? this.diag;
        const sortedNodes = this.getExecutableNodes();
        const seenParams = new Map<string, ShaderNode>();
        let hasDuplicate = false;

        for (const node of sortedNodes) {
            let pName: string | undefined;
            if (node instanceof TextureSampleNode && node.isParam) {
                pName = node.paramName ?? node.id;
            } else if (isShaderParam(node) && node.paramName) {
                pName = node.paramName;
            }

            if (pName) {
                const existing = seenParams.get(pName);
                if (existing) {
                    d.err({
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

        return !hasDuplicate;
    }

    /**
     * Precomputes uniform buffer byte layouts, offsets, and texture slot bindings.
     */
    buildParamLayout(sortedNodes?: ShaderNode[]): {
        paramLayout: ShaderParamLayout;
        textureNodes: CompiledTextureNode[];
    } {
        const nodes = sortedNodes ?? this.getExecutableNodes();
        const uniformsMap = new Map<string, UniformParamDef>();
        const texturesMap = new Map<string, TextureParamDef>();
        const textureNodes: CompiledTextureNode[] = [];

        let currentByteOffset = 0;

        for (const node of nodes) {
            if (node instanceof TextureSampleNode) {
                const texIdx = textureNodes.length;
                // Assign textureIndex onto the live node so wgsl generation
                // (which runs in the same compile pass) can read it.
                node.textureIndex = texIdx;
                // Snapshot: copy all values, keep no reference to the live node.
                const snapshot: CompiledTextureNode = {
                    nodeId:         node.id,
                    textureIndex:   texIdx,
                    isParam:        node.isParam,
                    paramName:      node.isParam ? (node.paramName ?? node.id) : undefined,
                    defaultTexture: node.defaultTexture,
                };
                textureNodes.push(snapshot);

                if (node.isParam) {
                    const paramName = node.paramName ?? node.id;
                    texturesMap.set(paramName, {
                        name: paramName,
                        bindingIndex: 1 + texIdx * 2, // texture at 1 + 2*i, sampler at 2 + 2*i (0 is uMaterial)
                        defaultTexture: node.defaultTexture,
                    });
                }
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

        // Align total uniform buffer size to 16-byte boundary
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

        return { paramLayout, textureNodes };
    }

    /**
     * Compiles the node graph using the registered shader compiler (or compiler specified in options).
     * Returns null and records diagnostic errors if compilation fails.
     */
    compile(options: {
        target?: string;
        meta?: Record<string, unknown>;
        skinned?: boolean;
        cullMode?: "none" | "front" | "back";
        topology?: "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";
        diag?: Adiag;
        compiler?: ShaderCompiler;
        [key: string]: unknown;
    } = {}): CompiledShaderBlueprint | null {
        const diag = options.diag ?? this.diag;
        diag.clear();

        if (!this.validateParams(diag)) {
            return null;
        }

        const compiler = options.compiler ?? ShaderGraph.defaultCompiler;
        if (!compiler) {
            diag.err({
                code: "ERR_NO_SHADER_COMPILER",
                raw: `No shader compiler registered for ShaderGraph "${this.name}". Register ShaderGraph.defaultCompiler or supply options.compiler.`,
            });
            return null;
        }

        return compiler(this, options);
    }
}
