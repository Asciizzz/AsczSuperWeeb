// Constants & Scalar Math
export {
    EPSILON,
    DEG2RAD,
    RAD2DEG,
    TAU,
    PI_HALF,
    PI_QUARTER,
    PI_THIRD,
    clamp,
    lerp,
    approxEquals,
} from "./constants.js";

// Vector & Matrix Classes
export { Vec2 } from "./vec2.js";
export { Vec3 } from "./vec3.js";
export { Vec4 } from "./vec4.js";
export { Quat } from "./quat.js";
export { Mat3 } from "./mat3.js";
export { Mat4 } from "./mat4.js";

// Spatial Primitives
export { Ray, Plane, AABB, Frustum } from "./spatial.js";

// Backward-Compatibility Type Aliases
import type { Vec2 } from "./vec2.js";
import type { Vec3 } from "./vec3.js";
import type { Vec4 } from "./vec4.js";
import type { Quat } from "./quat.js";
import type { Mat3 } from "./mat3.js";
import type { Mat4 } from "./mat4.js";

export type V2 = Vec2;
export type V3 = Vec3;
export type V4 = Vec4;
export type Q4 = Quat;
export type M9 = Mat3;
export type M16 = Mat4;
