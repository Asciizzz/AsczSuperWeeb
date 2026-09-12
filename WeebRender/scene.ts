import { EntityPool, ComponentSet, type Entity } from "../Atoolkit/aecs/index.js";
import { TransformCmp } from "./transform.js";
import { MeshCmp } from "./mesh.js";
import { ShaderCmp } from "./shadercmp.js";
import { SkinCmp } from "./skeleton.js";
import { CameraCmp } from "./camera.js";

export interface EngineInstance {
    update?(dt?: number): void;
    destroy?(): void;
}

export interface WeebSceneOptions {
    label?: string;
}

/**
 * WeebRender scene coordinator and entity manager.
 *
 * Stores canonical component sets, provides central entity existence validation,
 * manages deferred deletions, and acts as an engine host factory.
 */
export class WeebScene {
    readonly label: string;
    readonly pool = new EntityPool();

    // Canonical Component Sets (The Raw Data)
    readonly transforms = new ComponentSet<TransformCmp>();
    readonly meshes     = new ComponentSet<MeshCmp>();
    readonly shaders    = new ComponentSet<ShaderCmp>();
    readonly skins      = new ComponentSet<SkinCmp>();
    readonly cameras    = new ComponentSet<CameraCmp>();

    // Engine Registry
    private readonly _engines: EngineInstance[] = [];

    // Deferred Deletions & Existence Tracking
    private readonly _pendingDeletions: Entity[] = [];
    private readonly _living = new Set<Entity>();

    constructor(options: WeebSceneOptions = {}) {
        this.label = options.label ?? "WeebScene";
    }

    /**
     * Allocates a new entity identifier, optionally attaching initial components.
     */
    spawn(...components: object[]): Entity {
        const entity = this.pool.spawn();
        this._living.add(entity);

        for (let i = 0; i < components.length; i++) {
            const cmp = components[i];
            if (cmp instanceof TransformCmp) {
                this.transforms.set(entity, cmp);
            } else if (cmp instanceof MeshCmp) {
                this.meshes.set(entity, cmp);
            } else if (cmp instanceof ShaderCmp) {
                this.shaders.set(entity, cmp);
            } else if (cmp instanceof SkinCmp) {
                this.skins.set(entity, cmp);
            } else if (cmp instanceof CameraCmp) {
                this.cameras.set(entity, cmp);
            }
        }

        return entity;
    }

    /**
     * Validates whether an entity is currently alive.
     */
    isAlive(entity: Entity): boolean {
        return this._living.has(entity);
    }

    /**
     * Schedules an entity for deletion at the end of the frame.
     * Prevents modifying sets during active loops.
     */
    destroy(entity: Entity): void {
        if (this._living.has(entity)) {
            this._pendingDeletions.push(entity);
        }
    }

    /**
     * Flushes all deferred entity deletions across all canonical sets.
     */
    flush(): void {
        const len = this._pendingDeletions.length;
        if (len === 0) return;

        for (let i = 0; i < len; i++) {
            const ent = this._pendingDeletions[i];
            this.transforms.delete(ent);
            this.meshes.delete(ent);
            this.shaders.delete(ent);
            this.skins.delete(ent);
            this.cameras.delete(ent);
            this._living.delete(ent);
            this.pool.destroy(ent);
        }

        this._pendingDeletions.length = 0;
    }

    /**
     * Creates an engine instance bound directly to this scene's component sets,
     * registers it in the coordinator, and returns the engine reference.
     */
    createEngine<T extends EngineInstance, TOpts>(
        EngineClass: new (scene: WeebScene, options: TOpts) => T,
        options: TOpts
    ): T {
        const engine = new EngineClass(this, options);
        this._engines.push(engine);
        return engine;
    }

    /**
     * Registers an external engine instance with this coordinator.
     */
    addEngine<T extends EngineInstance>(engine: T): T {
        this._engines.push(engine);
        return engine;
    }

    /**
     * Returns all registered engine instances.
     */
    get engines(): readonly EngineInstance[] {
        return this._engines;
    }

    /**
     * Returns total number of living entities.
     */
    count(): number {
        return this._living.size;
    }

    /**
     * Steps all registered engines in sequence and flushes deferred deletions.
     */
    update(dt?: number): void {
        const len = this._engines.length;
        for (let i = 0; i < len; i++) {
            this._engines[i].update?.(dt);
        }
        this.flush();
    }

    /**
     * Clears all entities, component storage, and registered engines.
     */
    clear(): void {
        this.transforms.clear();
        this.meshes.clear();
        this.shaders.clear();
        this.skins.clear();
        this.cameras.clear();
        this.pool.clear();
        this._living.clear();
        this._pendingDeletions.length = 0;
        this._engines.length = 0;
    }
}
