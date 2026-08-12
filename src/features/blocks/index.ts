// The block system — shared by the presenter (read-only Views) and the studio
// (Editors + palette). Add a new block: create a folder with an `index.tsx`
// exporting a `BlockDefinition`, then register it in `registry.ts`. Both
// surfaces pick it up with no further wiring.

export type {
  Audience,
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
  createBlock,
  isTeacherOnly,
} from "./registry";

export { SlideView, BlockView } from "./slide-view";
export { renderInline } from "./inline-md";

// Editor toolkit — reused by the studio's own chrome (slide meta, teacher notes).
export { AutoTextarea } from "./editor-ui/auto-textarea";
export {
  AddRowButton,
  BlockLabelInput,
  DeleteRowButton,
  IconAction,
  NoteInput,
} from "./editor-ui/primitives";
