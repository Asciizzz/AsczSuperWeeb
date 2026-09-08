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
} from "./types.js";

/**
 * Directed computation circuit of shader micro-nodes connected via typed sockets.
 * A pure CPU data container representing shader AST topology and parameter definitions.
 * Contains zero compilation logic or target shading language code.
 */
export class ShaderCircuit extends Acircuit {
    readonly name: string;
    readonly diag: Adiag;
    private _lastOutputNode: OutputNode;

    constructor(name = "ShaderCircuit", diag?: Adiag) {
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
     * Dead / disconnected nodes and scratch loops are ignored.
     */
    getExecutableNodes(): ShaderNode[] {
        const contributing = this.getContributingNodes();
        if (contributing.size === 0) return [];

        const inDeps = new Map<string, Set<string>>();
        const outDeps = new Map<string, Set<string>>();

        for (const node of contributing) {
            inDeps.set(node.id, new Set());
            outDeps.set(node.id, new Set());
        }

        for (const node of contributing) {
            const inWires = this.getIncomingWires(node.id);
            for (const wire of inWires) {
                const producer = this.nodes.get(wire.outNodeId);
                if (producer instanceof ShaderNode && contributing.has(producer)) {
                    inDeps.get(node.id)!.add(wire.outNodeId);
                    outDeps.get(wire.outNodeId)!.add(node.id);
                }
            }
        }

        const readyQueue: string[] = [];
        for (const [nodeId, deps] of inDeps) {
            if (deps.size === 0) readyQueue.push(nodeId);
        }

        const sorted: ShaderNode[] = [];
        while (readyQueue.length > 0) {
            const currentId = readyQueue.shift()!;
            const node = this.nodes.get(currentId) as ShaderNode | undefined;
            if (node) sorted.push(node);

            for (const dependentId of outDeps.get(currentId)!) {
                const depSet = inDeps.get(dependentId)!;
                depSet.delete(currentId);
                if (depSet.size === 0) readyQueue.push(dependentId);
            }
        }

        if (sorted.length !== contributing.size) {
            throw new Error(`[ShaderGraph] Cyclic dependency detected among contributing nodes in "${this.name}".`);
        }

        return sorted;
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
        textureNodes: TextureSampleNode[];
    } {
        const nodes = sortedNodes ?? this.getExecutableNodes();
        const uniformsMap = new Map<string, UniformParamDef>();
        const texturesMap = new Map<string, TextureParamDef>();
        const textureNodes: TextureSampleNode[] = [];

        let currentByteOffset = 0;

        for (const node of nodes) {
            if (node instanceof TextureSampleNode) {
                const texIdx = textureNodes.length;
                node.textureIndex = texIdx;
                textureNodes.push(node);

                if (node.isParam) {
                    const paramName = node.paramName ?? node.id;
                    texturesMap.set(paramName, {
                        name: paramName,
                        textureIndex: texIdx,
                        bindingIndex: 1 + texIdx * 2,
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
}

export { ShaderCircuit as ShaderGraph };
