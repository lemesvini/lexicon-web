// The block system — shared by the presenter (read-only Views) and the studio
// (Editors + palette). Add a new block: create a folder with an `index.tsx`
// exporting a `BlockDefinition`, then register it in `registry.ts`. Both
// surfaces pick it up with no further wiring.

export type {
  Audience,
  BlockAnswerProps,
  BlockDefinition,
  BlockEditorProps,
  BlockMeta,
  BlockType,
  BlockViewProps,
} from "./types";

export {
  BLOCK_REGISTRY,
  BLOCK_METAS,
  BLOCK_ORDER,
  EXERCISE_BLOCK_ORDER,
  blockMetas,
  createBlock,
  isTeacherOnly,
} from "./registry";

export { newBlockId } from "./block-id";

export {
  SlideView,
  BlockView,
  AdvancedMark,
  isAdvancedMarked,
  SLIDE_ALIGN,
  SLIDE_JUSTIFY,
} from "./slide-view";
export { containerChildTypes } from "./container";
export {
  BrandMark,
  StagePreview,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./stage-preview";
export { renderInline } from "./inline-md";

// Editor toolkit — reused by the studio's own chrome (slide meta, teacher notes).
export { AutoTextarea } from "./editor-ui/auto-textarea";
export { Segmented } from "./editor-ui/segmented";
export {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  IconAction,
  NoteInput,
} from "./editor-ui/primitives";
