import { Mat4, type M16 } from "../../Atoolkit/alm/index.js";
import type { Entity, ComponentSet } from "../../Atoolkit/aecs/index.js";
import type { TransformCmp } from "../ecs/transform.js";
import type { WeebWorld } from "../ecs/world.js";

const scratchChildLocal = Mat4();

/**
 * Node hierarchy relationship descriptor for parent-child spatial propagation.
 */
export interface HierarchyNode {
    entity: Entity;
    parent?: Entity;
    children: Entity[];
}

/**
 * System that propagates world transform matrices down hierarchical parent-child trees.
 * Multiplies parent worldMatrix with child local matrix and marks child dirty for GPU upload.
 */
export class HierarchySystem {
    private nodes = new Map<Entity, HierarchyNode>();

    attach(parent: Entity, child: Entity): void {
        let parentNode = this.nodes.get(parent);
        if (!parentNode) {
            parentNode = { entity: parent, children: [] };
            this.nodes.set(parent, parentNode);
        }

        let childNode = this.nodes.get(child);
        if (!childNode) {
            childNode = { entity: child, parent, children: [] };
            this.nodes.set(child, childNode);
        } else {
            childNode.parent = parent;
        }

        if (!parentNode.children.includes(child)) {
            parentNode.children.push(child);
        }
    }

    detach(child: Entity): void {
        const childNode = this.nodes.get(child);
        if (!childNode || childNode.parent === undefined) return;

        const parentNode = this.nodes.get(childNode.parent);
        if (parentNode) {
            parentNode.children = parentNode.children.filter((id) => id !== child);
        }
        childNode.parent = undefined;
    }

    update(world: WeebWorld): void {
        for (const node of this.nodes.values()) {
            if (node.parent === undefined) {
                this.propagate(node, world.transforms);
            }
        }
    }

    private propagate(node: HierarchyNode, transforms: ComponentSet<TransformCmp>): void {
        const parentTransform = transforms.get(node.entity);
        if (!parentTransform) return;

        for (const childId of node.children) {
            const childTransform = transforms.get(childId);
            const childNode = this.nodes.get(childId);
            if (childTransform) {
                Mat4.fromTRS(
                    childTransform.position,
                    childTransform.rotation,
                    childTransform.scale,
                    scratchChildLocal
                );
                Mat4.mul(parentTransform.worldMatrix, scratchChildLocal, childTransform.worldMatrix);
                childTransform.isDirty = true;
            }

            if (childNode && childNode.children.length > 0) {
                this.propagate(childNode, transforms);
            }
        }
    }
}
