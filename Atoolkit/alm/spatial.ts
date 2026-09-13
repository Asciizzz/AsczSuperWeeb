import { EPSILON } from "./constants.js";
import { Vec3 } from "./vec3.js";
import { Mat4 } from "./mat4.js";

/**
 * Geometric Ray with an origin and normalized direction vector.
 */
export class Ray {
    readonly origin: Vec3;
    readonly direction: Vec3;

    constructor(origin?: Vec3, direction?: Vec3) {
        this.origin = origin ? origin.clone() : new Vec3(0, 0, 0);
        this.direction = direction ? direction.clone() : new Vec3(0, 0, -1);
    }

    set(origin: Vec3, direction: Vec3): this {
        this.origin.copy(origin);
        this.direction.copy(direction);
        return this;
    }

    copy(src: Ray): this {
        this.origin.copy(src.origin);
        this.direction.copy(src.direction);
        return this;
    }

    clone(): Ray {
        return new Ray(this.origin, this.direction);
    }

    /**
     * Computes point along ray at distance t: origin + direction * t.
     */
    at(t: number, out?: Vec3): Vec3 {
        out ??= new Vec3();
        out[0] = this.origin[0] + this.direction[0] * t;
        out[1] = this.origin[1] + this.direction[1] * t;
        out[2] = this.origin[2] + this.direction[2] * t;
        return out;
    }

    /**
     * Intersects ray with a sphere. Returns distance t >= 0 or null if no hit.
     */
    intersectSphere(center: Vec3, radius: number): number | null {
        const ox = this.origin[0] - center[0];
        const oy = this.origin[1] - center[1];
        const oz = this.origin[2] - center[2];

        const b = ox * this.direction[0] + oy * this.direction[1] + oz * this.direction[2];
        const c = ox * ox + oy * oy + oz * oz - radius * radius;

        if (c > 0 && b > 0) return null;
        const discr = b * b - c;
        if (discr < 0) return null;

        const t = -b - Math.sqrt(discr);
        return t >= 0 ? t : 0;
    }

    /**
     * Intersects ray with a plane. Returns distance t >= 0 or null if parallel / behind.
     */
    intersectPlane(plane: Plane): number | null {
        const denom = plane.normal.dot(this.direction);
        if (Math.abs(denom) < EPSILON) return null;

        const t = -(plane.normal.dot(this.origin) + plane.distance) / denom;
        return t >= 0 ? t : null;
    }

    /**
     * Intersects ray with an axis-aligned bounding box (AABB).
     * Returns distance t >= 0 or null if no intersection occurs.
     */
    intersectAABB(aabb: AABB): number | null {
        let tmin = -Infinity;
        let tmax = Infinity;

        for (let i = 0; i < 3; i++) {
            const invD = 1.0 / this.direction[i];
            let t0 = (aabb.min[i] - this.origin[i]) * invD;
            let t1 = (aabb.max[i] - this.origin[i]) * invD;

            if (invD < 0) {
                const temp = t0;
                t0 = t1;
                t1 = temp;
            }

            tmin = t0 > tmin ? t0 : tmin;
            tmax = t1 < tmax ? t1 : tmax;

            if (tmax < tmin) return null;
        }

        if (tmax < 0) return null;
        return tmin >= 0 ? tmin : tmax;
    }
}

/**
 * 3D Plane represented in Hesse normal form: normal . point + distance = 0.
 */
export class Plane {
    readonly normal: Vec3;
    distance: number;

    constructor(normal?: Vec3, distance = 0) {
        this.normal = normal ? normal.clone() : new Vec3(0, 1, 0);
        this.distance = distance;
    }

    set(normal: Vec3, distance: number): this {
        this.normal.copy(normal);
        this.distance = distance;
        return this;
    }

    setComponents(x: number, y: number, z: number, w: number): this {
        this.normal.setValues(x, y, z);
        this.distance = w;
        return this;
    }

    setFromCoplanarPoints(a: Vec3, b: Vec3, c: Vec3): this {
        const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
        const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];

        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;

        this.normal.setValues(nx, ny, nz);
        this.normalize();
        this.distance = -this.normal.dot(a);
        return this;
    }

    copy(src: Plane): this {
        this.normal.copy(src.normal);
        this.distance = src.distance;
        return this;
    }

    clone(): Plane {
        return new Plane(this.normal, this.distance);
    }

    normalize(): this {
        const len = this.normal.len();
        if (len > EPSILON) {
            const invLen = 1.0 / len;
            this.normal.scale(invLen);
            this.distance *= invLen;
        }
        return this;
    }

    distanceToPoint(point: Vec3): number {
        return this.normal.dot(point) + this.distance;
    }

    projectPoint(point: Vec3, out?: Vec3): Vec3 {
        out ??= new Vec3();
        const dist = this.distanceToPoint(point);
        out[0] = point[0] - this.normal[0] * dist;
        out[1] = point[1] - this.normal[1] * dist;
        out[2] = point[2] - this.normal[2] * dist;
        return out;
    }
}

/**
 * Axis-Aligned Bounding Box (AABB) defined by minimum and maximum extents.
 */
export class AABB {
    readonly min: Vec3;
    readonly max: Vec3;

    constructor(min?: Vec3, max?: Vec3) {
        this.min = min ? min.clone() : new Vec3(Infinity, Infinity, Infinity);
        this.max = max ? max.clone() : new Vec3(-Infinity, -Infinity, -Infinity);
    }

    set(min: Vec3, max: Vec3): this {
        this.min.copy(min);
        this.max.copy(max);
        return this;
    }

    setComponents(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): this {
        this.min.setValues(minX, minY, minZ);
        this.max.setValues(maxX, maxY, maxZ);
        return this;
    }

    copy(src: AABB): this {
        this.min.copy(src.min);
        this.max.copy(src.max);
        return this;
    }

    clone(): AABB {
        return new AABB(this.min, this.max);
    }

    reset(): this {
        this.min.setValues(Infinity, Infinity, Infinity);
        this.max.setValues(-Infinity, -Infinity, -Infinity);
        return this;
    }

    center(out?: Vec3): Vec3 {
        out ??= new Vec3();
        out[0] = (this.min[0] + this.max[0]) * 0.5;
        out[1] = (this.min[1] + this.max[1]) * 0.5;
        out[2] = (this.min[2] + this.max[2]) * 0.5;
        return out;
    }

    size(out?: Vec3): Vec3 {
        out ??= new Vec3();
        out[0] = Math.max(0, this.max[0] - this.min[0]);
        out[1] = Math.max(0, this.max[1] - this.min[1]);
        out[2] = Math.max(0, this.max[2] - this.min[2]);
        return out;
    }

    extents(out?: Vec3): Vec3 {
        out ??= new Vec3();
        out[0] = Math.max(0, (this.max[0] - this.min[0]) * 0.5);
        out[1] = Math.max(0, (this.max[1] - this.min[1]) * 0.5);
        out[2] = Math.max(0, (this.max[2] - this.min[2]) * 0.5);
        return out;
    }

    containsPoint(p: Vec3): boolean {
        return (
            p[0] >= this.min[0] && p[0] <= this.max[0] &&
            p[1] >= this.min[1] && p[1] <= this.max[1] &&
            p[2] >= this.min[2] && p[2] <= this.max[2]
        );
    }

    containsAABB(other: AABB): boolean {
        return (
            this.min[0] <= other.min[0] && other.max[0] <= this.max[0] &&
            this.min[1] <= other.min[1] && other.max[1] <= this.max[1] &&
            this.min[2] <= other.min[2] && other.max[2] <= this.max[2]
        );
    }

    intersectsAABB(other: AABB): boolean {
        return (
            this.max[0] >= other.min[0] && this.min[0] <= other.max[0] &&
            this.max[1] >= other.min[1] && this.min[1] <= other.max[1] &&
            this.max[2] >= other.min[2] && this.min[2] <= other.max[2]
        );
    }

    intersectsRay(ray: Ray): number | null {
        return ray.intersectAABB(this);
    }

    expandByPoint(p: Vec3): this {
        this.min[0] = Math.min(this.min[0], p[0]);
        this.min[1] = Math.min(this.min[1], p[1]);
        this.min[2] = Math.min(this.min[2], p[2]);

        this.max[0] = Math.max(this.max[0], p[0]);
        this.max[1] = Math.max(this.max[1], p[1]);
        this.max[2] = Math.max(this.max[2], p[2]);
        return this;
    }

    expandByAABB(other: AABB): this {
        this.min[0] = Math.min(this.min[0], other.min[0]);
        this.min[1] = Math.min(this.min[1], other.min[1]);
        this.min[2] = Math.min(this.min[2], other.min[2]);

        this.max[0] = Math.max(this.max[0], other.max[0]);
        this.max[1] = Math.max(this.max[1], other.max[1]);
        this.max[2] = Math.max(this.max[2], other.max[2]);
        return this;
    }

    /**
     * Transforms this bounding box by a 4x4 matrix and writes into out.
     */
    transform(m: Mat4, out: AABB = this): AABB {
        const minX = this.min[0], minY = this.min[1], minZ = this.min[2];
        const maxX = this.max[0], maxY = this.max[1], maxZ = this.max[2];

        // 8 corner vertices of the box
        const corners = [
            minX, minY, minZ,
            maxX, minY, minZ,
            minX, maxY, minZ,
            maxX, maxY, minZ,
            minX, minY, maxZ,
            maxX, minY, maxZ,
            minX, maxY, maxZ,
            maxX, maxY, maxZ,
        ];

        out.reset();
        const pt = new Vec3();
        for (let i = 0; i < 24; i += 3) {
            pt.setValues(corners[i], corners[i + 1], corners[i + 2]);
            pt.transformMat4(m);
            out.expandByPoint(pt);
        }
        return out;
    }

    static fromPoints(points: ArrayLike<number>, count: number, stride = 3, out?: AABB): AABB {
        out ??= new AABB();
        out.reset();
        const pt = new Vec3();
        let idx = 0;
        for (let i = 0; i < count; i++) {
            pt.setValues(points[idx], points[idx + 1], points[idx + 2]);
            out.expandByPoint(pt);
            idx += stride;
        }
        return out;
    }

    static fromCenterSize(center: Vec3, size: Vec3, out?: AABB): AABB {
        out ??= new AABB();
        const hx = size[0] * 0.5;
        const hy = size[1] * 0.5;
        const hz = size[2] * 0.5;
        out.min.setValues(center[0] - hx, center[1] - hy, center[2] - hz);
        out.max.setValues(center[0] + hx, center[1] + hy, center[2] + hz);
        return out;
    }
}

/**
 * Camera View Frustum containing 6 clipping planes (Left, Right, Bottom, Top, Near, Far).
 * Optimized for zero-allocation scene culling and camera testing.
 */
export class Frustum {
    readonly planes: [Plane, Plane, Plane, Plane, Plane, Plane];

    constructor() {
        this.planes = [
            new Plane(), // Left
            new Plane(), // Right
            new Plane(), // Bottom
            new Plane(), // Top
            new Plane(), // Near
            new Plane(), // Far
        ];
    }

    get left(): Plane {
        return this.planes[0];
    }
    get right(): Plane {
        return this.planes[1];
    }
    get bottom(): Plane {
        return this.planes[2];
    }
    get top(): Plane {
        return this.planes[3];
    }
    get near(): Plane {
        return this.planes[4];
    }
    get far(): Plane {
        return this.planes[5];
    }

    /**
     * Extracts normalized frustum planes from a view-projection matrix.
     * @param vp Combined view-projection matrix
     * @param isZeroToOne True for WebGPU/DirectX/Metal depth [0, 1]; False for WebGL/OpenGL [-1, 1]
     */
    fromViewProjection(vp: Mat4, isZeroToOne = true): this {
        const m00 = vp[0],  m01 = vp[1],  m02 = vp[2],  m03 = vp[3];
        const m10 = vp[4],  m11 = vp[5],  m12 = vp[6],  m13 = vp[7];
        const m20 = vp[8],  m21 = vp[9],  m22 = vp[10], m23 = vp[11];
        const m30 = vp[12], m31 = vp[13], m32 = vp[14], m33 = vp[15];

        // Left plane: row 3 + row 0
        this.planes[0].setComponents(m03 + m00, m13 + m10, m23 + m20, m33 + m30).normalize();

        // Right plane: row 3 - row 0
        this.planes[1].setComponents(m03 - m00, m13 - m10, m23 - m20, m33 - m30).normalize();

        // Bottom plane: row 3 + row 1
        this.planes[2].setComponents(m03 + m01, m13 + m11, m23 + m21, m33 + m31).normalize();

        // Top plane: row 3 - row 1
        this.planes[3].setComponents(m03 - m01, m13 - m11, m23 - m21, m33 - m31).normalize();

        // Near plane
        if (isZeroToOne) {
            // WebGPU clip space [0, 1]: row 2
            this.planes[4].setComponents(m02, m12, m22, m32).normalize();
        } else {
            // WebGL clip space [-1, 1]: row 3 + row 2
            this.planes[4].setComponents(m03 + m02, m13 + m12, m23 + m22, m33 + m32).normalize();
        }

        // Far plane: row 3 - row 2
        this.planes[5].setComponents(m03 - m02, m13 - m12, m23 - m22, m33 - m32).normalize();

        return this;
    }

    containsPoint(p: Vec3): boolean {
        for (let i = 0; i < 6; i++) {
            if (this.planes[i].distanceToPoint(p) < 0) {
                return false;
            }
        }
        return true;
    }

    intersectsSphere(center: Vec3, radius: number): boolean {
        for (let i = 0; i < 6; i++) {
            if (this.planes[i].distanceToPoint(center) < -radius) {
                return false;
            }
        }
        return true;
    }

    /**
     * Tests if an axis-aligned bounding box intersects or lies inside this frustum.
     * Essential for zero-allocation camera occlusion and frustum culling.
     */
    intersectsAABB(aabb: AABB): boolean {
        const min = aabb.min;
        const max = aabb.max;

        for (let i = 0; i < 6; i++) {
            const plane = this.planes[i];
            const normal = plane.normal;

            // Compute positive vertex along plane normal direction
            const px = normal[0] > 0 ? max[0] : min[0];
            const py = normal[1] > 0 ? max[1] : min[1];
            const pz = normal[2] > 0 ? max[2] : min[2];

            if (normal[0] * px + normal[1] * py + normal[2] * pz + plane.distance < 0) {
                return false;
            }
        }
        return true;
    }
}
