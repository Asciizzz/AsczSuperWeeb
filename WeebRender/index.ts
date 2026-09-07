// WeebRender Core Module Exports

// 3D Transforms
export {
    TransformCmp,
    updateTransformSystem,
} from "./transform.js";

// Camera
export {
    CameraCmp,
} from "./camera.js";

// Mesh & Submeshes
export {
    Mesh,
    MeshCmp,
    createVertexBufferLayout,
    type Submesh,
    type VertexAttribute,
} from "./mesh.js";

// Skeleton & Skinning
export {
    Skeleton,
    SkinCmp,
    updateSkinSystem,
    type Joint,
} from "./skeleton.js";

// Textures
export {
    Texture,
} from "./texture.js";


// Extensions: Procedural Generators & Presets
export {
    createBoxMesh,
    createPlaneMesh,
    createSphereMesh,
    createCheckerTexture,
    createSolidColorTexture,
    createMandelbrotTexture,
    createJuliaTexture,
    createVoronoiTexture,
    createFbmNoiseTexture,
    createWaveRippleTexture,
    createPolarSpiralTexture,
    createSkinnedBarMesh,
    createTwoBoneSkeleton,
    STANDARD_ATTRIBUTES,
    SKINNED_ATTRIBUTES,
    ELECTRIC_PALETTE,
    FIRE_PALETTE,
    OCEAN_PALETTE,
    GRAYSCALE_PALETTE,
    type ColorPaletteFn,
} from "./extensions/index.js";

// Shader Graph & Node System
export {
    Shader,
    ShaderGraph,
    ShaderNode,
    ColorNode,
    FloatNode,
    TextureSampleNode,
    MathNode,
    MixNode,
    BlendNode,
    ColorMixNode,
    BasicShadingNode,
    OutputNode,
    isShaderParam,
    type ShaderParamProvider,
    ParamVec4Node,
    ParamFloatNode,
    ConstColorNode,
    ConstFloatNode,
    ShaderParamsCmp,
    createColorShader,
    createTextureShader,
    createDefaultShader,
    createSkinnedColorShader,
    createSkinnedTextureShader,
    createShadedColorShader,
    createShadedTextureShader,
    createSkinnedShadedColorShader,
    createSkinnedShadedTextureShader,
    type SocketType,
    type InputSocket,
    type OutputSocket,
    type SocketLink,
    type ShaderParamLayout,
    type UniformParamDef,
    type TextureParamDef,
} from "./shader/index.js";

// Materials & Appearance
export {
    MaterialCmp,
    type MaterialSlot,
    type MaterialParamValue,
    type MaterialParamRecord,
} from "./material.js";

// Renderer & Execution Flow
export {
    WeebRenderer,
    SceneDrawStep,
    FrameStart,
    FrameEnd,
    type WeebRendererOptions,
} from "./renderer.js";

// GLB Loader
export {
    parseGlb,
    extractGlbChunks,
    loadGlbFromUrl,
    loadGlbFromFile,
    spawnLoadedModel,
    createSampleRiggedGlb,
    type LoadedModel,
    type LoadedMaterial,
    type GlbHeader,
    type GlbChunk,
} from "./loader/index.js";
