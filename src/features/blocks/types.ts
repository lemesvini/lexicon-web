import type { LucideIcon } from "lucide-react";
import type { LessonBlock } from "@/lib/lessons";

export type BlockType = LessonBlock["type"];

/** Which surface is viewing a slide. The projected display shows student-facing
 *  content only; the teacher's control device also sees teacher-only blocks
 *  (answer keys, profile cards) marked `audience: "teacher"`. */
export type Audience = "student" | "teacher";

/** Palette + chrome metadata for a block type. */
export type BlockMeta = {
  type: BlockType;
  label: string;
  hint: string;
  icon: LucideIcon;
};

export type BlockViewProps<T> = { block: T; audience: Audience };
export type BlockEditorProps<T> = {
  block: T;
  onChange: (next: T) => void;
};

/**
 * A single, self-contained block type. Everything the app needs to know about a
 * block lives in its module: how to describe it (`meta`), create a blank one
 * (`create`), render it read-only (`View`, for the presenter), and edit it
 * (`Editor`, for the studio). Add a block = add a folder exporting one of these
 * and register it in `registry.ts`; both surfaces pick it up automatically.
 */
export type BlockDefinition<T extends LessonBlock> = {
  meta: BlockMeta;
  create: () => T;
  View: React.FC<BlockViewProps<T>>;
  Editor: React.FC<BlockEditorProps<T>>;
};
