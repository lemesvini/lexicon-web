# Lesson Browser (Finder-style column browser) — Design

## Purpose

Replace the placeholder card on the homepage (`/`) with a macOS Finder-style
column browser for picking a lesson: Module → Lesson, with a preview pane on
the right showing mock slide content and lesson metadata.

This is the first step toward the "simple lesson list page" called for in
`src/docs/presenter.md` Phase 2. This pass is UI + mock data only — no
Supabase wiring, no navigation into `/present` or `/control`.

## Scope

In scope:
- Two-column Finder-style browser (Module, Lesson) with a preview pane.
- Mock data for modules/lessons.
- Selection state and click-to-drill-down interaction.
- Styling using the app's existing theme tokens (light/dark aware).

Out of scope (deferred to later passes):
- Real data from Supabase.
- Navigation/action buttons to `/present/:lessonId` or `/control/:lessonId`.
- Keyboard navigation.
- Arbitrary-depth nesting (hardcoded to exactly 2 levels + preview).

## File layout

- `src/features/homepage/lesson-browser.tsx` — the `LessonBrowser` component.
  Contains the whole UI (both columns + preview pane) plus a small internal
  `Column` sub-component reused for the module list and the lesson list.
- `src/features/homepage/mock-lessons.ts` — mock data + types.

This is a one-off, non-reusable component scoped entirely to the homepage
feature — no generic/shared primitive is being built.

## Data model (`mock-lessons.ts`)

```ts
type Lesson = {
  id: string;
  title: string;        // e.g. "Ordering at a Restaurant"
  situation: string;    // e.g. "Situation 3"
  description: string;
  canDo: string;        // CEFR-style can-do statement
  grammarPoint: string;
};

type Module = {
  id: string;
  name: string;         // "Module One", "Module Two", ...
  lessons: Lesson[];
};

export const MOCK_MODULES: Module[];
```

~4 mock modules, 2–4 lessons each, content themed around Lexicon's B2B
corporate English lessons (matching the "Situation" naming already implied by
the app's domain).

## Interaction & state

- Local state in `LessonBrowser`: `selectedModuleId`, `selectedLessonId`.
- On mount, defaults to the first module and that module's first lesson, so
  the preview pane isn't empty on first paint.
- Clicking a module row selects it and resets `selectedLessonId` to that
  module's first lesson.
- Clicking a lesson row selects it and updates the preview pane.
- No links, buttons, or routing — selection only affects local component
  state.

## Visual layout

- The homepage wrapper div that currently reads
  `<div className="flex flex-1 bg-red-500 items-center justify-center p-4">`
  loses the debug `bg-red-500` and the centering; the `<Card>` stretches to
  fill the available space instead of shrink-wrapping to its content.
- Inside the `Card`: a horizontal flex row, `divide-x divide-border`, no card
  padding — columns run edge-to-edge, matching Finder.
  - **Column 1 (modules)** and **Column 2 (lessons)**: fixed width (e.g.
    `w-56`), independently scrollable (`overflow-y-auto`). Each row is an
    icon + label (`Folder` + `ChevronRight` for modules since they always
    have children; `BookOpen` for lessons, no chevron since they're leaves).
    Selected row: `bg-primary text-primary-foreground`. Hover (non-selected):
    `hover:bg-accent hover:text-accent-foreground`.
  - **Column 3 (preview)**: `flex-1`, padded. Top: an `aspect-video`
    rectangle (`bg-muted`) with the lesson title centered in `font-display`,
    mimicking a title slide. Below: situation label, description paragraph,
    then two labeled metadata rows for "Can-do" and "Grammar point".
- All colors come from existing theme tokens (`bg-accent`,
  `text-muted-foreground`, `border`, `bg-primary`, `bg-muted`) so the browser
  respects the app's light/dark toggle automatically — no hardcoded dark
  Finder look.

## Icons

`lucide-react` (already a dependency): `Folder`, `ChevronRight`, `BookOpen`.

## Testing

Manual verification only (visual component, no business logic): run the dev
server, confirm module/lesson selection updates the preview pane, and check
both light and dark themes.
