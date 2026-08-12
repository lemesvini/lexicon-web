import type { LessonBlock } from "@/lib/lessons";
import type { BlockDefinition, BlockMeta, BlockType } from "./types";
import { textBlock } from "./text";
import { listBlock } from "./list";
import { calloutBlock } from "./callout";
import { tableBlock } from "./table";
import { dialogBlock } from "./dialog";
import { imageBlock } from "./image";

/** Maps each block type to its definition, preserving the per-type generic so
 *  each entry stays exactly `BlockDefinition<ThatBlock>` (no `any`). */
type Registry = {
  [K in BlockType]: BlockDefinition<Extract<LessonBlock, { type: K }>>;
};

export const BLOCK_REGISTRY: Registry = {
  text: textBlock,
  list: listBlock,
  callout: calloutBlock,
  table: tableBlock,
  dialog: dialogBlock,
  image: imageBlock,
};

/** Palette order — how block types appear in the studio's add menus. */
export const BLOCK_ORDER: BlockType[] = [
  "text",
  "list",
  "callout",
  "table",
  "dialog",
  "image",
];

/** Ordered metadata list for building palettes / add menus. */
export const BLOCK_METAS: BlockMeta[] = BLOCK_ORDER.map(
  (type) => BLOCK_REGISTRY[type].meta,
);

/** A blank block of the given type, from its registered factory. */
export function createBlock(type: BlockType): LessonBlock {
  return BLOCK_REGISTRY[type].create();
}

/** Teacher-only blocks (answer keys, profile cards) are hidden from students. */
export function isTeacherOnly(block: LessonBlock): boolean {
  return (
    (block.type === "text" || block.type === "callout") &&
    block.audience === "teacher"
  );
}
