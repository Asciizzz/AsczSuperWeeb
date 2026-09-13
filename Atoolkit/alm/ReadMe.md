# Alm (Math)

High-performance 3D linear algebra library for native `Float32Array` buffers. Designed for zero-allocation loops, in-place rotations, and WebGPU clip space compatibility.

---

## Buffer Types

All types represent native typed array slices without wrapper class overhead:

| Type | Backing Storage | Component Packing | Memory Footprint |
| :--- | :--- | :--- | :--- |
| `Mat4` | `Float32Array(16)` | Column-major 4x4 matrix | 64 bytes |
| `Vec3` | `Float32Array(3)` | 3D Cartesian coordinates `[x, y, z]` | 12 bytes |
| `Vec2` | `Float32Array(2)` | 2D coordinates `[x, y]` | 8 bytes |
| `Vec4` | `Float32Array(4)` | Homogeneous vector or color `[x, y, z, w]` | 16 bytes |
| `Quat` | `Float32Array(4)` | Unit quaternion `[x, y, z, w]` | 16 bytes |

---

## 1. Zero-Allocation Calling Convention

Every mathematical function accepts an optional `out` parameter. Supplying a pre-allocated buffer executes operations purely through in-place arithmetic without heap allocations:

```typescript
import { Mat4, Vec3 } from "./index.js";

const viewProj = new Float32Array(16);
const model = new Float32Array(16);
const mvp = new Float32Array(16);

// Multiplies viewProj * model directly into mvp with zero heap allocations
Mat4.mul(viewProj, model, mvp);
```

- When `out` is supplied: Mutates and returns the destination buffer. No arrays or objects are allocated.
- When `out` is omitted: Allocates and returns a fresh `Float32Array` of the corresponding dimensions.

---

## 2. 4x4 Matrices (`Mat4`)

`Mat4` provides column-major 4x4 matrix operations, camera projections, in-place axis rotations, and rigid-body inversions.

```typescript
import { Mat4, Vec3, Quat } from "./index.js";

// Matrix synthesis
const model = Mat4.makeIdentity();
const pos = Vec3(0, 5, -10);
const rot = Quat.fromAxisAngle(Vec3.UP, Math.PI / 4);
const scale = Vec3(1, 1, 1);

// Synthesize TRS matrix
Mat4.fromTRS(pos, rot, scale, model);

// In-place rotation around X axis (modifies model directly without temporary matrices)
Mat4.rotateX(model, Math.PI / 6, model);

// Fast rigid inverse for camera view matrices
const view = new Float32Array(16);
Mat4.invertRigid(model, view);

// Projections
const projWebGPU = Mat4.perspectiveZO(Math.PI / 3, 16 / 9, 0.1, 1000.0);
const projWebGL  = Mat4.perspectiveNO(Math.PI / 3, 16 / 9, 0.1, 1000.0);
```

- `Mat4.makeIdentity(out?)`: Writes identity matrix with diagonal ones.
- `Mat4.mul(a, b, out?)`: Multiplies 4x4 matrices `a * b`.
- `Mat4.transpose(a, out?)`: Transposes rows and columns. Safe for in-place execution (`Mat4.transpose(m, m)`).
- `Mat4.invert(a, out?)`: Computes general 4x4 matrix inverse using cofactor expansion. Returns `null` if determinant is zero.
- `Mat4.invertRigid(a, out?)`: Optimized inverse for rigid transformations and camera view matrices. Transposes the 3x3 rotation block and evaluates translation `-R^T * T`, computing exact inverse without general matrix determinant calculations.
- `Mat4.normalMatrix(m, out?)`: Computes 3x3 inverse-transpose matrix written into 9-element target for surface lighting calculations.
- `Mat4.fromTRS(pos, rotQ, scale, out?)`: Constructs complete model matrix directly from translation vector, quaternion rotation, and scale vector.
- `Mat4.rotateX(m, rad, out?)` / `rotateY` / `rotateZ`: Rotates matrix around coordinate axes via direct trigonometric updates to column vectors, avoiding intermediate matrix allocation.
- `Mat4.rotate(m, axis, rad, out?)`: In-place rotation around normalized arbitrary axis vector.
- `Mat4.perspectiveZO(fovy, aspect, near, far, out?)`: Perspective projection configured for zero-to-one `[0, 1]` depth range (WebGPU, Metal, DirectX 12).
- `Mat4.perspectiveNO(fovy, aspect, near, far, out?)`: Perspective projection configured for negative-one-to-one `[-1, 1]` depth range (WebGL, OpenGL).
- `Mat4.orthoZO(left, right, bottom, top, near, far, out?)`: Orthographic projection with `[0, 1]` depth range.
- `Mat4.orthoNO(left, right, bottom, top, near, far, out?)`: Orthographic projection with `[-1, 1]` depth range.
- `Mat4.lookAt(eye, target, up, out?)`: View matrix positioning camera at `eye` facing `target` with designated `up` vector.

---

## 3. 3D Vectors (`Vec3`)

`Vec3` provides Cartesian vector math, cross products, transformations, and bounding box evaluations.

```typescript
import { Vec3, Mat4, Quat } from "./index.js";

const v1 = Vec3(1, 2, 3);
const v2 = Vec3(4, 5, 6);
const result = Vec3();

// Arithmetic
Vec3.add(v1, v2, result);
Vec3.cross(v1, v2, result);
const dot = Vec3.dot(v1, v2);

// Normalization with epsilon guard
Vec3.norm(v1, result);

// Transformations
const model = Mat4.makeIdentity();
const point = Vec3(10, 0, 0);

// Point transformation (w = 1, applies translation)
Vec3.transformMat4(point, model, result);

// Direction transformation (w = 0, ignores translation)
Vec3.transformMat4Direction(point, model, result);

// Quaternion rotation
const q = Quat.fromAxisAngle(Vec3.UP, Math.PI / 2);
Vec3.transformQuat(point, q, result);
```

- Standard constants: `Vec3.UP` `[0, 1, 0]`, `Vec3.DOWN` `[0, -1, 0]`, `Vec3.RIGHT` `[1, 0, 0]`, `Vec3.LEFT` `[-1, 0, 0]`, `Vec3.FORWARD` `[0, 0, 1]`, `Vec3.BACK` `[0, 0, -1]`, `Vec3.ZERO` `[0, 0, 0]`, `Vec3.ONE` `[1, 1, 1]`.
- `Vec3.dot(a, b)`: Scalar dot product.
- `Vec3.cross(a, b, out?)`: Vector cross product.
- `Vec3.len(a)` / `Vec3.lenSq(a)`: Length and squared length. `lenSq` omits square root for fast distance threshold checks.
- `Vec3.norm(a, out?)`: Normalizes vector with epsilon protection against division by zero.
- `Vec3.transformMat4(v, m, out?)`: Transforms 3D point assuming homogeneous coordinate `w = 1.0`, applying full translation and projection.
- `Vec3.transformMat4Direction(v, m, out?)`: Transforms 3D direction vector assuming `w = 0.0`, ignoring matrix translation columns.
- `Vec3.transformQuat(v, q, out?)`: Rotates 3D vector by unit quaternion using Hamiltonian vector conjugation.
- `Vec3.reflect(v, normal, out?)`: Computes reflection direction against unit surface normal for physics and lighting.

---

## 4. Quaternions (`Quat`)

`Quat` provides unit quaternion operations for spatial rotations without gimbal lock.

```typescript
import { Quat, Vec3, Mat4 } from "./index.js";

// Identity and construction
const q1 = Quat.makeIdentity();
const q2 = Quat.fromAxisAngle(Vec3.UP, Math.PI / 2);
const q3 = Quat.fromEuler(0, Math.PI / 4, 0); // Yaw 45 deg

// Hamiltonian product
const combined = Quat();
Quat.mul(q2, q3, combined);

// Spherical linear interpolation
const blended = Quat();
Quat.slerp(q2, q3, 0.5, blended);

// Convert to rotation matrix
const rotMatrix = new Float32Array(16);
Mat4.fromQuat(combined, rotMatrix);

// Extract quaternion from matrix
const extracted = Quat();
Quat.fromM4(rotMatrix, extracted);
```

- Storage format: Unit quaternion stored in `[x, y, z, w]` order where `w` is scalar real part.
- `Quat.IDENTITY`: Constant `[0, 0, 0, 1]`.
- `Quat.mul(a, b, out?)`: Hamilton product combining rotation `a` followed by rotation `b`.
- `Quat.conjugate(q, out?)`: Reverses vector components `[-x, -y, -z, w]`, calculating exact inverse for unit quaternions.
- `Quat.invert(q, out?)`: General quaternion inverse with length-squared normalization.
- `Quat.fromAxisAngle(axis, rad, out?)`: Constructs unit quaternion from arbitrary normalized 3D axis and rotation angle in radians.
- `Quat.fromEuler(x, y, z, out?)`: Converts Euler angles in radians (XYZ order) into rotation quaternion.
- `Quat.toEulerYPR(q, out?)`: Extracts yaw, pitch, and roll angles in degrees from quaternion.
- `Quat.fromM4(m, out?)`: Extracts rotation quaternion directly from 4x4 matrix column vectors.
- `Quat.slerp(a, b, t, out?)`: Spherical linear interpolation between quaternions along shortest geodesic arc.
- `Quat.transformV3(q, v, out?)`: Rotates 3D vector by quaternion directly without intermediate matrix construction.
