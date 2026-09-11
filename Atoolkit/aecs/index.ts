export { Aecs, type AecsOptions } from "./Aecs.js";
export { Aquery, type ComponentClass, type InferComponentInstances } from "./Aquery.js";
export { SparseSet } from "./SparseSet.js";
export {
    type Aent,
    aent,
    aentIndex,
    aentGen,
    aentToString,
    AENT_NULL,
    AENT_INDEX_BITS,
    AENT_INDEX_MASK,
    AENT_GEN_BITS,
    AENT_GEN_MASK,
} from "./Aent.js";

// Re-export Acmp for convenient component authoring
