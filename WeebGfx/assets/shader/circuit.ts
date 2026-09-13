import { Acircuit, type Acnode } from "../../../Atoolkit/acircuit/index.js";
import { Adiag } from "../../../Atoolkit/adiag/index.js";
import {
    ShaderNode,
    OutputNode,
    ColorNode,
    FloatNode,
    TextureSampleNode,
    isShaderParam,
} from "./nodes.js";
import type {
    ShaderParamLayout,
    UniformParamDef,
    TextureParamDef,
    PipelineRenderState,
} from "./types.js";

/**
 * Directed computation circuit of shader micro-nodes connected via typed sockets.
 * Pure CPU data container representing shader AST topology and parameter definitions.
 */
export class ShaderCircuit extends Acircuit {
    readonly name: string;
    readonly diag: Adiag;
    renderState: PipelineRenderState = {};
    private _lastOutputNode: OutputNode;

    constructor(name = "ShaderCircuit", renderState?: PipelineRenderState, diag?: Adiag) {
        super({ label: name });
        this.name = name;
        this.diag = diag ?? new Adiag();
        this.renderState = renderState ?? { blendMode: "opaque", cullMode: "back", depthMode: "read-write" };
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

    override addNode(node: Acnode): this {
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
            throw new Error(`[ShaderCircuit] Cyclic dependency detected in circuit "${this.name}".`);
        }

        return sorted;
    }

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
                if (node instanceof ColorNode) {
                    currentByteOffset = Math.ceil(currentByteOffset / 16) * 16;
                    uniformsMap.set(node.paramName, {
                        name: node.paramName,
                        type: "vec4",
                        byteOffset: currentByteOffset,
                        sizeBytes: 16,
                        defaultValue: [...node.defaultColor],
                    });
                    currentByteOffset += 16;
                } else if (node instanceof FloatNode) {
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

        const totalUniformBytes = Math.max(16, Math.ceil(currentByteOffset / 16) * 16);
        const defaultUniformData = new Float32Array(totalUniformBytes / 4);

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
