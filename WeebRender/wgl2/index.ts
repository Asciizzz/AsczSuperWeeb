/**
 * WebGL2 Backend for WeebRender (Stub / Architectural Roadmap).
 *
 * Future components for WebGL2:
 * - GMesh: Manages WebGLVertexArrayObject (VAO), VBO, and IBO.
 * - GTexture: Manages WebGLTexture with 2D sampler parameters.
 * - GShader: Manages WebGLProgram compiled via GLSL 3.0 ES from ShaderGraph.
 * - Wgl2Renderer: WebGL2 render pass loop and uniform setting.
 */

export interface Wgl2RendererOptions {
    antialias?: boolean;
    clearColor?: { r: number; g: number; b: number; a: number };
}
