# lexicon-web

Vite + React 19 + TanStack Router, Tailwind v4, Supabase. `pnpm dev`,
`pnpm build` (runs `tsc -b` first), `pnpm lint`.

## Authoring lesson JSON

**Read [docs/lesson-json.md](docs/lesson-json.md) before writing or editing any
lesson, material or homework JSON.**

Nothing validates a block on import: `parseLesson`
(`src/features/studio/model.ts`) checks only for an object with a `slides`
array, then passes the blocks straight to the renderers. Wrong enum values are
not caught — they either render as the wrong thing or throw at render time and
take the page down.

The traps, in short:

- `title` blocks take `jade` / `forest` / `mist` / `clear`. `callout` blocks
  take `blue_bg` / `green_bg` / `yellow_bg` / `gray_bg` / `red_bg`. Same field
  name, no shared values; a callout colour on a title block **crashes**.
- `list` blocks require `style` — no default.
- Exercise blocks need a stable `id`; `answer` is a 0-based index into
  `options`; homework only.
- `image.path` is a Supabase Storage object path from a real upload. Never
  invent one.
- Save as UTF-8. These lessons contain Portuguese and mojibake ends up on a
  projector.

`src/lib/lessons.ts` is the source of truth for every block shape.
