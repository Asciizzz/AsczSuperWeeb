import { EntityPool, ComponentSet, type Entity } from "../../Atoolkit/aecs/index.js";
import { TransformCmp } from "./transform.js";
import { MeshCmp } from "./meshcmp.js";
import { ShaderCmp } from "./shadercmp.js";
import { SkinCmp } from "./skincmp.js";

/**
 * ECS Scene / World Container.
 * Manages entity allocation and contiguous component storage sets.
 */
export class WeebWorld {
    readonly pool = new EntityPool();
    readonly transforms = new ComponentSet<TransformCmp>();
    readonly meshes = new ComponentSet<MeshCmp>();
    readonly shaders = new ComponentSet<ShaderCmp>();
    readonly skins = new ComponentSet<SkinCmp>();

    spawn(
        transform: TransformCmp,
        mesh: MeshCmp,
        shader: ShaderCmp,
        skin?: SkinCmp
    ): Entity {
        const entity = this.pool.spawn();
        this.transforms.set(entity, transform);
        this.meshes.set(entity, mesh);
        this.shaders.set(entity, shader);
        if (skin) {
            this.skins.set(entity, skin);
        }
        return entity;
    }

    destroy(entity: Entity): void {
        this.transforms.delete(entity);
        this.meshes.delete(entity);
        this.shaders.delete(entity);
        this.skins.delete(entity);
        this.pool.destroy(entity);
    }

    clear(): void {
        this.transforms.clear();
        this.meshes.clear();
        this.shaders.clear();
        this.skins.clear();
    }
}

export { WeebWorld as WeebScene };
