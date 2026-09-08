// 3D Transforms
export {
    TransformCmp,
    updateTransformSystem,
} from "./transform.js";

// Camera
export {
    CameraCmp,
} from "./camera.js";

// Mesh & Submeshes (Pure CPU Assets)
export {
    Mesh,
    MeshCmp,
    type Submesh,
    type VertexAttribute,
} from "./mesh.js";

// Skeleton & Skinning (Pure CPU Assets)
export {
    Skeleton,
    SkinCmp,
    updateSkinSystem,
    type Joint,
} from "./skeleton.js";

// Textures (Pure CPU Assets)
export {
    Texture,
} from "./texture.js";

// Universal GPU Resource Handles & Type Guards
export {
    GpuTexture,
    GpuMesh,
    GpuShader,
    Shader,
    isGpuTexture,
    isGpuMesh,
    isGpuShader,
} from "./gpu.js";

// WebGPU Hardware Implementation & Renderer
export {
    WgpuTexture,
    type WgpuTextureOptions,
    type WgpuTextureRefOptions,
    type WgpuTexturePayload,
    WgpuMesh,
    createVertexBufferLayout,
    type WgpuMeshOptions,
    type WgpuMeshPayload,
    WgpuShader,
    type WgpuShaderPayload,
    WgpuRenderer,
    SceneDrawStep,
    BeginFrame,
    EndFrame,
    FrameStart,
    FrameEnd,
    RenderPass,
    EndPass,
    type AwgpuCtx,
    type WgpuRendererOptions,
    // Ergonomic aliases for the active backend
    GTexture,
    type GTextureOptions,
    type GTextureRefOptions,
    GMesh,
    type GMeshOptions,
    GShader,
} from "./wgpu/index.js";

// Namespace export for wgpu and wgl2
export * as wgpu from "./wgpu/index.js";
export * as wgl2 from "./wgl2/index.js";

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

// Shader Circuit & Node System
export {
    ShaderCircuit,
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
