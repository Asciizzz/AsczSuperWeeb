import { ShaderCircuit } from "../assets/shader/circuit.js";
import {
    ShaderNode,
    ColorNode,
    FloatNode,
    TextureSampleNode,
    TimeNode,
    BlendNode,
    BasicShadingNode,
    MathNode,
    MixNode,
    SmoothStepNode,
    SDFShapeNode,
    OutputNode,
} from "../assets/shader/nodes.js";

export interface CompileOptions {
    skinned?: boolean;
}

function getExpressionForInput(
    circuit: ShaderCircuit,
    node: ShaderNode,
    inputSocket: string,
    fallbackExpr: string
): string {
    const wires = circuit.getIncomingWires(node.id);
    const wire = wires.find((w) => w.inSocket === inputSocket);
    if (wire) {
        return `node_${wire.outNodeId}_${wire.outSocket}`;
    }
    return fallbackExpr;
}

function generateNodeWgsl(circuit: ShaderCircuit, node: ShaderNode): string {
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

    if (node instanceof FloatNode) {
        if (node.isParam && node.paramName) {
            return `
    let ${p}_value: f32 = uMaterial.${node.paramName};`;
        }
        return `
    let ${p}_value: f32 = ${node.defaultValue.toFixed(4)};`;
    }

    if (node instanceof TextureSampleNode) {
        const uvExpr = getExpressionForInput(circuit, node, "uv", "in.uv");
        const texBinding = `t_tex_${node.textureIndex}`;
        const sampBinding = `s_tex_${node.textureIndex}`;
        return `
    let ${p}_color: vec4<f32> = textureSample(${texBinding}, ${sampBinding}, ${uvExpr});
    let ${p}_rgb: vec3<f32> = ${p}_color.rgb;
    let ${p}_alpha: f32 = ${p}_color.a;`;
    }

    if (node instanceof TimeNode) {
        return `
    let ${p}_time: f32 = uGlobal.timeAndBeat.x;
    let ${p}_sinTime: f32 = sin(${p}_time);
    let ${p}_beatPulse: f32 = uGlobal.timeAndBeat.y;`;
    }

    if (node instanceof MathNode) {
        const inA = getExpressionForInput(circuit, node, "a", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inB = getExpressionForInput(circuit, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        let op = "*";
        if (node.operation === "add") op = "+";
        else if (node.operation === "subtract") op = "-";
        else if (node.operation === "divide") op = "/";
        return `    let ${p}_out = ${inA} ${op} ${inB};`;
    }

    if (node instanceof MixNode) {
        const inA = getExpressionForInput(circuit, node, "a", "vec4<f32>(0.0, 0.0, 0.0, 1.0)");
        const inB = getExpressionForInput(circuit, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inFactor = getExpressionForInput(circuit, node, "factor", node.defaultFactor.toFixed(4));
        return `    let ${p}_out = mix(${inA}, ${inB}, ${inFactor});`;
    }

    if (node instanceof SmoothStepNode) {
        const inX = getExpressionForInput(circuit, node, "x", "0.0");
        const inE0 = getExpressionForInput(circuit, node, "edge0", node.edge0.toFixed(4));
        const inE1 = getExpressionForInput(circuit, node, "edge1", node.edge1.toFixed(4));
        return `    let ${p}_out: f32 = smoothstep(${inE0}, ${inE1}, ${inX});`;
    }

    if (node instanceof SDFShapeNode) {
        const inUv = getExpressionForInput(circuit, node, "uv", "in.uv");
        const inR = getExpressionForInput(circuit, node, "radius", "0.5");
        if (node.shape === "circle") {
            return `
    let ${p}_dist: f32 = length(${inUv} - vec2<f32>(0.5, 0.5));
    let ${p}_mask: f32 = smoothstep(${inR} + 0.01, ${inR} - 0.01, ${p}_dist);`;
        }
        if (node.shape === "rect") {
            return `
    let ${p}_d = abs(${inUv} - vec2<f32>(0.5, 0.5)) - vec2<f32>(${inR} * 0.5);
    let ${p}_dist: f32 = length(max(${p}_d, vec2<f32>(0.0))) + min(max(${p}_d.x, ${p}_d.y), 0.0);
    let ${p}_mask: f32 = smoothstep(0.01, -0.01, ${p}_dist);`;
        }
        if (node.shape === "diamond") {
            return `
    let ${p}_d2 = abs(${inUv}.x - 0.5) + abs(${inUv}.y - 0.5);
    let ${p}_dist: f32 = ${p}_d2;
    let ${p}_mask: f32 = smoothstep(${inR} + 0.01, ${inR} - 0.01, ${p}_d2);`;
        }
        return `
    let ${p}_dist: f32 = length(${inUv} - vec2<f32>(0.5, 0.5));
    let ${p}_mask: f32 = smoothstep(0.05, 0.0, abs(${p}_dist - ${inR}));`;
    }

    if (node instanceof BlendNode) {
        const inA = getExpressionForInput(circuit, node, "a", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inB = getExpressionForInput(circuit, node, "b", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inMode = getExpressionForInput(circuit, node, "mode", node.defaultMode.toFixed(1));
        const inFactor = getExpressionForInput(circuit, node, "factor", node.defaultFactor.toFixed(4));
        return `
        var ${p}_out: vec4<f32>;
        let ${p}_m = i32(${inMode} + 0.5);
        if (${p}_m == 0) {
            ${p}_out = ${inA} * ${inB};
        } else if (${p}_m == 1) {
            ${p}_out = clamp(${inA} + ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
        } else if (${p}_m == 2) {
            ${p}_out = clamp(${inA} - ${inB}, vec4<f32>(0.0), vec4<f32>(1.0));
        } else {
            ${p}_out = mix(${inA}, ${inB}, ${inFactor});
        }`;
    }

    if (node instanceof BasicShadingNode) {
        const inColor = getExpressionForInput(circuit, node, "color", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const inAmbient = getExpressionForInput(circuit, node, "ambient", node.defaultAmbient.toFixed(4));
        const inDiffuse = getExpressionForInput(circuit, node, "diffuse", node.defaultDiffuse.toFixed(4));
        const inLightDir = getExpressionForInput(circuit, node, "lightDir", "normalize(vec3<f32>(0.5, 0.8, 0.4))");
        return `
        let ${p}_inColor = ${inColor};
        let ${p}_N = in.worldNormal;
        let ${p}_diff = max(dot(${p}_N, ${inLightDir}), 0.0);
        let ${p}_intensity = ${inAmbient} + ${p}_diff * ${inDiffuse};
        let ${p}_out = vec4<f32>(${p}_inColor.rgb * ${p}_intensity, ${p}_inColor.a);`;
    }

    if (node instanceof OutputNode) {
        const baseColorExpr = getExpressionForInput(circuit, node, "baseColor", "vec4<f32>(1.0, 1.0, 1.0, 1.0)");
        const emissiveExpr = getExpressionForInput(circuit, node, "emissive", "");
        const alphaExpr = getExpressionForInput(circuit, node, "alpha", "");

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

/**
 * Compiles a ShaderCircuit into clean WGSL shader code with 4-tier frequency slots.
 */
export function compileCircuitToWgsl(
    circuit: ShaderCircuit,
    options: CompileOptions = {}
): string {
    const sortedNodes = circuit.getExecutableNodes();
    const { paramLayout, textureNodes } = circuit.buildParamLayout(sortedNodes);

    const statements: string[] = [];
    for (const node of sortedNodes) {
        const code = generateNodeWgsl(circuit, node);
        if (code.trim().length > 0) {
            statements.push(code);
        }
    }

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

    const textureBindingsWGSL = textureNodes
        .map((_, i) => {
            return (
                `@group(2) @binding(${1 + i * 2}) var t_tex_${i}: texture_2d<f32>;\n` +
                `@group(2) @binding(${2 + i * 2}) var s_tex_${i}: sampler;`
            );
        })
        .join("\n");

    const skinned = options.skinned ?? false;

    const skinBindingWGSL = skinned
        ? `@group(3) @binding(1) var<storage, read> uBones: array<mat4x4<f32>>;`
        : "";

    const vsBodyWGSL = skinned
        ? `
    let jointIndices = in.joints;
    let jointWeights = in.weights;

    let bone0 = uBones[jointIndices.x];
    let bone1 = uBones[jointIndices.y];
    let bone2 = uBones[jointIndices.z];
    let bone3 = uBones[jointIndices.w];

    let skinMatrix =
        bone0 * jointWeights.x +
        bone1 * jointWeights.y +
        bone2 * jointWeights.z +
        bone3 * jointWeights.w;

    let worldPos4 = uObject.modelMatrix * skinMatrix * vec4<f32>(in.position, 1.0);
    var out: VertexOutput;
    out.clipPosition = uGlobal.viewProj * worldPos4;
    out.worldPos = worldPos4.xyz;
    let skinNorm = (skinMatrix * vec4<f32>(in.normal, 0.0)).xyz;
    out.worldNormal = normalize((uObject.modelMatrix * vec4<f32>(skinNorm, 0.0)).xyz);
    out.uv = in.uv;
    return out;`
        : `
    let worldPos4 = uObject.modelMatrix * vec4<f32>(in.position, 1.0);
    var out: VertexOutput;
    out.clipPosition = uGlobal.viewProj * worldPos4;
    out.worldPos = worldPos4.xyz;
    out.worldNormal = normalize((uObject.modelMatrix * vec4<f32>(in.normal, 0.0)).xyz);
    out.uv = in.uv;
    return out;`;

    const vertexInputStructWGSL = skinned
        ? `
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) joints: vec4<u32>,
    @location(4) weights: vec4<f32>,
};`
        : `
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
};`;

    return `
struct GlobalUniforms {
    viewProj: mat4x4<f32>,
    cameraPos: vec4<f32>,
    timeAndBeat: vec4<f32>, // x = time, y = beatPulse, z = aspect, w = tempo
    screenRes: vec4<f32>,   // xy = resolution, zw = pad
};

struct ObjectUniforms {
    modelMatrix: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> uGlobal: GlobalUniforms;
@group(3) @binding(0) var<uniform> uObject: ObjectUniforms;

${materialStructWGSL}
${materialBindingWGSL}
${skinBindingWGSL}
${textureBindingsWGSL}

${vertexInputStructWGSL}

struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) worldNormal: vec3<f32>,
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
