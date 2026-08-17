import type { LessonBlock } from "@/lib/lessons";
import type { BlockDefinition, BlockMeta, BlockType } from "./types";
import { textBlock } from "./text";
import { listBlock } from "./list";
import { calloutBlock } from "./callout";
import { tableBlock } from "./table";
import { dialogBlock } from "./dialog";
import { imageBlock } from "./image";
import { titleBlock } from "./title";
import { finishSentenceBlock } from "./finish-sentence";
import { chooseDescriptionBlock } from "./choose-description";
import { longAnswerBlock } from "./long-answer";

/** Maps each block type to its definition, preserving the per-type generic so
 *  each entry stays exactly `BlockDefinition<ThatBlock>` (no `any`). */
type Registry = {
  [K in BlockType]: BlockDefinition<Extract<LessonBlock, { type: K }>>;
};

export const BLOCK_REGISTRY: Registry = {
  title: titleBlock,
  text: textBlock,
  list: listBlock,
  callout: calloutBlock,
  table: tableBlock,
  dialog: dialogBlock,
  image: imageBlock,
  "finish-sentence": finishSentenceBlock,
  "choose-description": chooseDescriptionBlock,
  "long-answer": longAnswerBlock,
};

/** Palette order — how block types appear in the studio's add menus. */
export const BLOCK_ORDER: BlockType[] = [
  "title",
  "text",
  "list",
  "callout",
  "table",
  "dialog",
  "image",
];

/**
 * The blocks a student answers, and the only ones homework is authored from.
 *
 * Kept out of BLOCK_ORDER rather than filtered out of it: a presentation or a
 * student material has nowhere to put an answer, so offering an exercise there
 * would be offering something that can never be submitted.
 */
export const EXERCISE_BLOCK_ORDER: BlockType[] = [
  "finish-sentence",
  "choose-description",
  "long-answer",
];

/** Ordered metadata for a set of block types — feeds palettes and add menus. */
export function blockMetas(types: BlockType[]): BlockMeta[] {
  return types.map((type) => BLOCK_REGISTRY[type].meta);
}

/** Ordered metadata list for building palettes / add menus. */
export const BLOCK_METAS: BlockMeta[] = blockMetas(BLOCK_ORDER);

/** A blank block of the given type, from its registered factory. */
export function createBlock(type: BlockType): LessonBlock {
  return BLOCK_REGISTRY[type].create();
}

/** Teacher-only blocks (answer keys, profile cards) are hidden from students.
 *  Any block type can be marked, matching `strip_teacher_content` in the
 *  database, which drops a flagged block whatever its type. */
export function isTeacherOnly(block: LessonBlock): boolean {
  return block.audience === "teacher";
}
