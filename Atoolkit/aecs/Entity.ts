export type Entity = number;

/**
 * Minimal entity identifier allocator with recycled slot reuse.
 */
export class EntityPool {
    private _nextId = 1;
    private _free: Entity[] = [];

    spawn(): Entity {
        return this._free.length > 0 ? this._free.pop()! : this._nextId++;
    }

    destroy(entity: Entity): void {
        this._free.push(entity);
    }

    clear(): void {
        this._nextId = 1;
        this._free.length = 0;
    }
}
