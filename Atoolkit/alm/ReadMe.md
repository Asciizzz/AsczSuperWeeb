# Alm (Math)

3D linear algebra library for WebGPU, written for native `Float32Array` buffers.

---

## Buffer Types

| Class | Buffer Type | Description |
| :--- | :--- | :--- |
| `Mat4` | `Float32Array(16)` | Column-major 4x4 matrix. |
| `Vec3` | `Float32Array(3)` | 3D vector for points, directions, bounding boxes, and cross products. |
| `Vec2` | `Float32Array(2)` | 2D vector for texture coordinates and screen space. |
| `Vec4` | `Float32Array(4)` | 4D homogeneous coordinates and colors. |
| `Quat` | `Float32Array(4)` | Unit quaternion stored as [x, y, z, w]. |

---

## Zero Allocations

Functions accept optional `out` parameters to write directly into target buffers without allocating typed arrays:

```ts
const mvp = new Float32Array(16);
Mat4.mul(viewProj, model, mvp); // Zero GC allocations
```

---

## API

### `Mat4`

- **Creation & Copies**:
  - `Mat4()`: Allocates `new Float32Array(16)`.
  - `Mat4.makeIdentity(out?)`: Writes identity matrix.
  - `Mat4.copy(a, out?)`: Copies values.
  - `Mat4.mul(a, b, out?)`: Multiplies `a * b`.
  - `Mat4.transpose(a, out?)`: Transposes matrix. Safe for in-place use (`Mat4.transpose(m, m)`).
- **Inversion**:
  - `Mat4.invert(a, out?)`: General 4x4 inverse. Returns null if determinant is zero.
  - `Mat4.invertRigid(a, out?)`: Fast inverse for rigid transforms and camera view matrices via transposed rotation and `-R^T * T`.
  - `Mat4.normalMatrix(m, out?)`: Computes 3x3 inverse-transpose normal matrix for lighting.
- **Transforms**:
  - `Mat4.fromTranslation(v, out?)`
  - `Mat4.fromScaling(v, out?)`
  - `Mat4.fromRotationX(rad, out?)` / `fromRotationY` / `fromRotationZ`
  - `Mat4.fromQuat(q, out?)`
  - `Mat4.fromTRS(pos, rotQ, scale, out?)`
  - `Mat4.translate(m, v, out?)`
  - `Mat4.scale(m, v, out?)`
  - `Mat4.rotateX(m, rad, out?)`: In-place rotation around X axis without temporary matrices.
  - `Mat4.rotateY(m, rad, out?)`: In-place rotation around Y axis.
  - `Mat4.rotateZ(m, rad, out?)`: In-place rotation around Z axis.
  - `Mat4.rotate(m, axis, rad, out?)`: In-place rotation around normalized arbitrary axis.
  - `Mat4.rotateQ(m, q, out?)`: Rotates matrix by quaternion.
- **Projections**:
  - `Mat4.perspectiveZO(fovy, aspect, near, far, out?)`: Zero-to-one [0, 1] depth range (WebGPU, Metal, DirectX 12).
  - `Mat4.perspectiveNO(fovy, aspect, near, far, out?)`: Negative-one-to-one [-1, 1] depth range (WebGL, OpenGL).
  - `Mat4.orthoZO(left, right, bottom, top, near, far, out?)`: [0, 1] orthographic.
  - `Mat4.orthoNO(left, right, bottom, top, near, far, out?)`: [-1, 1] orthographic.
  - `Mat4.lookAt(eye, target, up, out?)`: View matrix facing `target` from `eye`.
- **Vector Multiplication**:
  - `Mat4.transformV2(m, v, out?)`
  - `Mat4.transformV3(m, v, out?)`: Transforms 3D point (w = 1).
  - `Mat4.transformV4(m, v, out?)`

### `Vec3`

- **Constants**: `Vec3.UP`, `Vec3.DOWN`, `Vec3.RIGHT`, `Vec3.LEFT`, `Vec3.FORWARD`, `Vec3.BACK`, `Vec3.ZERO`, `Vec3.ONE`.
- **Operations**:
  - `Vec3.set(x, y, z, out?)`, `Vec3.copy(a, out?)`
  - `Vec3.add(a, b, out?)`, `Vec3.sub(a, b, out?)`, `Vec3.mul(a, b, out?)`
  - `Vec3.scale(a, s, out?)`, `Vec3.scaleAndAdd(a, b, s, out?)`
  - `Vec3.dot(a, b)`, `Vec3.cross(a, b, out?)`
  - `Vec3.len(a)`, `Vec3.lenSq(a)` (squared length omitting square roots)
  - `Vec3.norm(a, out?)`: Normalizes vector with epsilon guard.
  - `Vec3.distance(a, b)`, `Vec3.distanceSq(a, b)`
  - `Vec3.lerp(a, b, t, out?)`
  - `Vec3.min(a, b, out?)`, `Vec3.max(a, b, out?)`: Component-wise bounding box bounds.
  - `Vec3.clamp(v, min, max, out?)`
  - `Vec3.reflect(v, normal, out?)`: Reflection vector for lighting and physics.
  - `Vec3.angle(a, b)`: Angle between vectors in radians.
  - `Vec3.transformMat4(v, m, out?)`: Point transform with w = 1.
  - `Vec3.transformMat4Direction(v, m, out?)`: Direction transform with w = 0 (ignores translation).
  - `Vec3.transformQuat(v, q, out?)`: Rotates vector by quaternion.
  - `Vec3.equals(a, b, epsilon?)`, `Vec3.exactEquals(a, b)`

### `Quat`

- `Quat.IDENTITY`: Constant `[0, 0, 0, 1]`.
- `Quat.makeIdentity(out?)`
- `Quat.mul(a, b, out?)`: Hamilton product.
- `Quat.conjugate(q, out?)`: Inverse for unit quaternions.
- `Quat.invert(q, out?)`: General quaternion inverse.
- `Quat.fromAxisAngle(axis, rad, out?)`
- `Quat.fromEuler(x, y, z, out?)`: Converts Euler angles in radians (XYZ order) to quaternion.
- `Quat.toEulerYPR(q, out?)`: Converts quaternion to yaw/pitch/roll degrees.
- `Quat.fromM4(m, out?)`: Extracts rotation quaternion from 4x4 matrix.
- `Quat.slerp(a, b, t, out?)`: Spherical linear interpolation.
- `Quat.transformV3(q, v, out?)`: Rotates 3D vector by quaternion.
