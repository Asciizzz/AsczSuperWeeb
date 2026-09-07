import { ShaderGraph } from "./graph.js";
import { ColorNode, TextureSampleNode, BlendNode, FloatNode, BasicShadingNode } from "./nodes.js";
import { WgpuShader, GShader } from "../wgpu/wshader.js";
import type { GpuTexture } from "../gpu.js";

/**
 * Creates a shader that outputs a solid color, with parameter "baseColor".
 */
export function createColorShader(
    color: number[] = [1, 1, 1, 1],
    name = "ColorShader"
): GShader {
    const graph = new ShaderGraph(name);
    const colorNode = new ColorNode("colorNode", color, true, "baseColor");
    colorNode.metadata = { x: 80, y: 120 };
    graph.outputNode.metadata = { x: 420, y: 120 };

    graph.addNode(colorNode);
    const bp = graph.compile();
    if (!bp) throw new Error(`[createColorShader] Compilation failed: ${graph.diag.lastErr()?.raw}`);
    return new GShader(bp, graph);
}

/**
 * Creates a shader that combines a texture with a tint color using a dynamic blend operation.
 * Parameters:
 * - "mainTexture" (Texture)
 * - "tintColor" (vec4, default [1, 1, 1, 1])
 * - "blendMode" (float, default 0: 0=Multiply, 1=Add, 2=Subtract, 3=Mix, 4=TextureOnly, 5=TintOnly, 6=Divide)
 * - "blendFactor" (float, default 0.5, controls linear interpolation for mode 3)
 */
export function createTextureShader(
    texture: GpuTexture | null = null,
    tint: number[] = [1, 1, 1, 1],
    name = "TextureShader"
): GShader {
    const graph = new ShaderGraph(name);

    const texNode = new TextureSampleNode("texNode", texture, true, "mainTexture");
    const tintNode = new ColorNode("tintNode", tint, true, "tintColor");
    const modeNode = new FloatNode("modeNode", 0.0, true, "blendMode");
    const factorNode = new FloatNode("factorNode", 0.5, true, "blendFactor");
    const blendNode = new BlendNode("blendNode");

    texNode.metadata = { x: 60, y: 60 };
    tintNode.metadata = { x: 60, y: 220 };
    modeNode.metadata = { x: 60, y: 350 };
    factorNode.metadata = { x: 60, y: 440 };
    blendNode.metadata = { x: 380, y: 120 };
    graph.outputNode.metadata = { x: 680, y: 120 };

    graph.addNode(texNode);
    graph.addNode(tintNode);
    graph.addNode(modeNode);
    graph.addNode(factorNode);
    graph.addNode(blendNode);

    graph.connect(texNode, "color", blendNode, "a");
    graph.connect(tintNode, "color", blendNode, "b");
    graph.connect(modeNode, "value", blendNode, "mode");
    graph.connect(factorNode, "value", blendNode, "factor");
    const bp = graph.compile();
    if (!bp) throw new Error(`[createTextureShader] Compilation failed: ${graph.diag.lastErr()?.raw}`);
    return new GShader(bp, graph);
}

/**
 * Default fallback white shader.
 */
export function createDefaultShader(): GShader {
    return createColorShader([1, 1, 1, 1], "DefaultShader");
}

/**
 * Creates a shaded solid-color shader that routes color through a BasicShadingNode.
 * Wire: colorNode -> basicShading.color (1 wire) -> outputNode.baseColor
 */
export function createShadedColorShader(
    color: number[] = [1, 1, 1, 1],
    ambient = 0.28,
    diffuse = 0.72,
    name = "ShadedColorShader"
): GShader {
    const graph = new ShaderGraph(name);
    const colorNode = new ColorNode("colorNode", color, true, "baseColor");
    const shadingNode = new BasicShadingNode("shadingNode", ambient, diffuse);

    colorNode.metadata = { x: 80, y: 120 };
    shadingNode.metadata = { x: 380, y: 120 };
    graph.outputNode.metadata = { x: 680, y: 120 };

    graph.addNode(colorNode);
    graph.addNode(shadingNode);

    // 1-wire primary connection into shading node, then to output
    graph.connect(colorNode, "color", shadingNode, "color");
    const bp = graph.compile();
    if (!bp) throw new Error(`[createShadedColorShader] Compilation failed: ${graph.diag.lastErr()?.raw}`);
    return new GShader(bp, graph);
}

/**
 * Creates a shaded texture shader that routes blend result through a BasicShadingNode.
 * Wire: blendNode -> basicShading.color (1 wire) -> outputNode.baseColor
 */
export function createShadedTextureShader(
    texture: GpuTexture | null = null,
    tint: number[] = [1, 1, 1, 1],
    ambient = 0.28,
    diffuse = 0.72,
    name = "ShadedTextureShader"
): GShader {
    const graph = new ShaderGraph(name);

    const texNode = new TextureSampleNode("texNode", texture, true, "mainTexture");
    const tintNode = new ColorNode("tintNode", tint, true, "tintColor");
    const modeNode = new FloatNode("modeNode", 0.0, true, "blendMode");
    const factorNode = new FloatNode("factorNode", 0.5, true, "blendFactor");
    const blendNode = new BlendNode("blendNode");
    const shadingNode = new BasicShadingNode("shadingNode", ambient, diffuse);

    texNode.metadata = { x: 60, y: 60 };
    tintNode.metadata = { x: 60, y: 220 };
    modeNode.metadata = { x: 60, y: 350 };
    factorNode.metadata = { x: 60, y: 440 };
    blendNode.metadata = { x: 380, y: 120 };
    shadingNode.metadata = { x: 660, y: 120 };
    graph.outputNode.metadata = { x: 940, y: 120 };

    graph.addNode(texNode);
    graph.addNode(tintNode);
    graph.addNode(modeNode);
    graph.addNode(factorNode);
    graph.addNode(blendNode);
    graph.addNode(shadingNode);

    graph.connect(texNode, "color", blendNode, "a");
    graph.connect(tintNode, "color", blendNode, "b");
    graph.connect(modeNode, "value", blendNode, "mode");
    graph.connect(factorNode, "value", blendNode, "factor");

    // 1-wire connection into basic shading node, then to output
    graph.connect(blendNode, "out", shadingNode, "color");
    const bp = graph.compile();
    if (!bp) throw new Error(`[createShadedTextureShader] Compilation failed: ${graph.diag.lastErr()?.raw}`);
    return new GShader(bp, graph);
}
