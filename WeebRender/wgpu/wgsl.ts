import { ShaderGraph, type CompiledShaderBlueprint } from "../shader/graph.js";
import {
    ShaderNode,
    ColorNode,
    FloatNode,
    TextureSampleNode,
    BlendNode,
    BasicShadingNode,
    MathNode,
    MixNode,
    OutputNode,
    ParamVec4Node,
    ParamFloatNode,
} from "../shader/nodes.js";
import type { ShaderParamLayout } from "../shader/types.js";
import type { Adiag } from "../../Atoolkit/adiag/index.js";

export interface WgslCompileOptions {
    target?: string;
    meta?: Record<string, unknown>;
    skinned?: boolean;
    cullMode?: "none" | "front" | "back";
    topology?: "point-list" | "line-list" | "line-strip" | "triangle-list" | "triangle-strip";
    diag?: Adiag;
}

function getExpressionForInput(
    graph: ShaderGraph,
    node: ShaderNode,
    inputSocket: string,
    fallbackExpr: string
): string {
    const wires = graph.getIncomingWires(node.id);
    const wire = wires.find(w => w.inSocket === inputSocket);
    if (wire) {
        return `node_${wire.outNodeId}_${wire.outSocket}`;
    }
    return fallbackExpr;
}

function generateNodeWgsl(graph: ShaderGraph, node: ShaderNode): string {
    const p = `node_${node.id}`;

    if (node instanceof ColorNode) {
        if (node.isParam && node.paramName) {
            return `
    let ${p}_color: vec4<f32> = uMaterial.${node.paramName};
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
        }
        const [r, g, b, a] = node.defaultColor;
        return `
    let ${p}_color: vec4<f32> = vec4<f32>(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}, ${(a ?? 1.0).toFixed(4)});
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }

    if (node instanceof ParamVec4Node) {
        return `
    let ${p}_color: vec4<f32> = uMaterial.${node.paramName};
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }

    if (node instanceof FloatNode) {
        if (node.isParam && node.paramName) {
            return `
    let ${p}_value: f32 = uMaterial.${node.paramName};`;
        }
        return `
    let ${p}_value: f32 = ${node.defaultValue.toFixed(4)};`;
    }

    if (node instanceof ParamFloatNode) {
        return `
    let ${p}_value: f32 = uMaterial.${node.paramName};`;
    }

    if (node instanceof TextureSampleNode) {
        const uvExpr = getExpressionForInput(graph, node, "uv", "in.uv");
        const texBinding = `t_tex_${node.textureIndex}`;
        const sampBinding = `s_tex_${node.textureIndex}`;
        return `
    let ${p}_color: vec4<f32> = textureSample(${texBinding}, ${sampBinding}, ${uvExpr});
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }

    if (node instanceof MathNode) {
        const inA = getExpressionForInput(graph, node, "a", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inB = getExpressionForInput(graph, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        let op = "*";
        if (node.operation === "add") op = "+";
        else if (node.operation === "subtract") op = "-";
        else if (node.operation === "divide") op = "/";
        return `let ${p}_out = ${inA} ${op} ${inB};`;
    }

    if (node instanceof MixNode) {
        const inA = getExpressionForInput(graph, node, "a", "vec4<f32>(0.0, 0.0, 0.0, 1.0)");
        const inB = getExpressionForInput(graph, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inFactor = getExpressionForInput(graph, node, "factor", node.defaultFactor.toFixed(4));
        return `let ${p}_out = mix(${inA}, ${inB}, ${inFactor});`;
    }

    if (node instanceof BlendNode) {
        const inA = getExpressionForInput(graph, node, "a", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inB = getExpressionForInput(graph, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inMode = getExpressionForInput(graph, node, "mode", node.defaultMode.toFixed(1));
        const inFactor = getExpressionForInput(graph, node, "factor", node.defaultFactor.toFixed(4));
        return `
        var ${p}_out: vec4<f32>;
        let ${p}_m = i32(${inMode} + 0.5);
        if (${p}_m == 0) {
            ${p}_out = ${inA} * ${inB};
        } else if (${p}_m == 1) {
            ${p}_out = clamp(${inA} + ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
        } else if (${p}_m == 2) {
            ${p}_out = clamp(${inA} - ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
        } else if (${p}_m == 3) {
            ${p}_out = mix(${inA}, ${inB}, ${inFactor});
        } else if (${p}_m == 4) {
            ${p}_out = ${inA};
        } else if (${p}_m == 5) {
            ${p}_out = ${inB};
        } else {
            ${p}_out = clamp(${inA} / max(${inB}, vec4<f32>(0.0001, 0.0001, 0.0001, 0.0001)), vec4<f32>(0.0), vec4<f32>(1.0));
        }`;
    }

    if (node instanceof BasicShadingNode) {
        const inColor = getExpressionForInput(graph, node, "color", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inAmbient = getExpressionForInput(graph, node, "ambient", node.defaultAmbient.toFixed(4));
        const inDiffuse = getExpressionForInput(graph, node, "diffuse", node.defaultDiffuse.toFixed(4));
        const [lx, ly, lz] = node.defaultLightDir;
        const inLightDir = getExpressionForInput(
            graph,
            node,
            "lightDir",
            `normalize(vec3<f32>(${lx.toFixed(4)}, ${ly.toFixed(4)}, ${lz.toFixed(4)}))`
        );
        return `
        let ${p}_inColor = ${inColor};
        let ${p}_normLen = length(in.normal);
        let ${p}_N = select(vec3<f32>(0.0, 1.0, 0.0), in.normal / max(${p}_normLen, 0.0001), ${p}_normLen > 0.0001);
        let ${p}_keyDir = ${inLightDir};
        let ${p}_keyDiff = max(dot(${p}_N, ${p}_keyDir), 0.0);
        let ${p}_fillDir = normalize(vec3<f32>(-0.6, 0.2, -0.4));
        let ${p}_fillDiff = max(dot(${p}_N, ${p}_fillDir), 0.0) * 0.35;
        let ${p}_intensity = ${inAmbient} + ${p}_keyDiff * ${inDiffuse} + ${p}_fillDiff;
        let ${p}_out = vec4<f32>(${p}_inColor.rgb * ${p}_intensity, ${p}_inColor.a);`;
    }

    if (node instanceof OutputNode) {
        const baseColorExpr = getExpressionForInput(graph, node, "baseColor", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const emissiveExpr = getExpressionForInput(graph, node, "emissive", "");
        const alphaExpr = getExpressionForInput(graph, node, "alpha", "");

        let code = `    finalSurfaceColor = ${baseColorExpr};`;
        if (alphaExpr) {
            code += `\n    finalSurfaceColor.a = finalSurfaceColor.a * (${alphaExpr});`;
        }
        if (emissiveExpr) {
            code += `\n    finalSurfaceColor = vec4<f32>(finalSurfaceColor.rgb + (${emissiveExpr}), finalSurfaceColor.a);`;
        }
        return code;
    }

    return "";
}

function assembleWgslSource(
    paramLayout: ShaderParamLayout,
    textureNodes: TextureSampleNode[],
    statements: string[],
    skinned = false
): string {
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

    const textureBindingsWGSL = textureNodes
        .map((node, i) => {
            return (
                `@group(2) @binding(${1 + i * 2}) var t_tex_${i}: texture_2d<f32>;\n` +
                `@group(2) @binding(${2 + i * 2}) var s_tex_${i}: sampler;`
            );
        })
        .join("\n");

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
        return out;
        `;

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

${textureBindingsWGSL}

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
${statements.join("\n")}

    return finalSurfaceColor;
}
`;
}

/**
 * Compiles a language-agnostic ShaderGraph into WebGPU WGSL shader code and precomputes uniform layouts.
 */
export function compileWgsl(
    graph: ShaderGraph,
    options: WgslCompileOptions = {}
): CompiledShaderBlueprint | null {
    const diag = options.diag ?? graph.diag;
    diag.clear();

    // 1. Validate parameters uniqueness on contributing nodes
    const valid = graph.validateParams(diag);
    if (!valid) return null;

    // 2. Topological sort of contributing nodes
    const sortedNodes = graph.getExecutableNodes();

    // 3. Extract layout & texture nodes
    const { paramLayout, textureNodes } = graph.buildParamLayout(sortedNodes);

    // 4. Generate per-node statements
    const statements: string[] = [];
    for (const node of sortedNodes) {
        const stmt = generateNodeWgsl(graph, node);
        if (stmt.trim().length > 0) {
            statements.push(stmt);
        }
    }

    // 5. Assemble WGSL shader source (both static and skinned)
    const codeStatic = assembleWgslSource(paramLayout, textureNodes, statements, false);
    const codeSkinned = assembleWgslSource(paramLayout, textureNodes, statements, true);
    const getCode = (isSkinned: boolean) => (isSkinned ? codeSkinned : codeStatic);
    const defaultCode = options.skinned ? codeSkinned : codeStatic;

    return {
        name: graph.name,
        code: defaultCode,
        codeSkinned,
        getCode,
        paramLayout,
        textureNodes,
        orderedNodes: sortedNodes,
        skinned: options.skinned ?? true,
        cullMode: options.cullMode,
        topology: options.topology,
    };
}

// Register as default compiler for ShaderGraph
ShaderGraph.defaultCompiler = compileWgsl;
