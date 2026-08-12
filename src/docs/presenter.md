# Lexicon Presenter — Claude Code Context

## What this is

Web app (SPA) used by the **teacher** of Lexicon English, a B2B corporate English training business, to present lessons in class. Two surfaces of the same app:

- **Display** (`/present/:lessonId`) — runs on a Mac connected to a projector/TV, or shared via Meet/Teams. Read-only. Renders the current slide fullscreen and mirrors whiteboard strokes.
- **Control** (`/control/:lessonId`) — runs on an iPad (Safari, Apple Pencil) in the teacher's hand while walking around the room. Shows current slide + **teacher notes**, prev/next navigation, and a **digital whiteboard**.

The two devices sync via **Supabase Realtime Broadcast** (no webhooks, no custom server, no AirPlay/Sidecar). The Mac is a dumb screen; the iPad is the single source of commands.

This app is for the teacher only. The **student app** is a separate Expo (React Native) project. They share nothing except the Supabase backend and, eventually, the content block schema types.

## Stack

- **Vite + React + TypeScript** (scaffolded with `npm create vite@latest`)
- **supabase-js** (auth, Postgres, Realtime, Storage)
- **@excalidraw/excalidraw** for the whiteboard (MIT — do NOT use tldraw: its SDK requires a paid commercial license in production)
- React Router for the two routes
- Deploy target: Cloudflare Pages (static SPA)

Explicit non-goals: no Next.js (no SSR/SEO needed — internal tool, 2 concurrent users), no Expo web, no state management library until pain demands it.

## Architecture principles

1. **Slides are a view over lesson content, not a separate artifact.** A lesson is a JSON document made of typed content blocks (authored in Notion, synced to Supabase — the sync pipeline is out of scope for this repo). A slide is `{ type: "slide", blocks: [...] }` reusing those block types, plus presentation-only types (big title, full-bleed image).
2. **The schema is the contract.** Block types live in `src/schema/` (Zod schemas + inferred TS types). This folder will later be extracted to a shared package (`@lexicon/content-schema`, pnpm workspace) consumed by both this app and the student Expo app. Keep it dependency-light and framework-free: no React imports inside `src/schema/`.
3. **iPad publishes, Mac subscribes.** Navigation and whiteboard state flow one way through a Realtime channel `lesson:{lessonId}`. Last-write-wins; no conflict resolution needed because the iPad is the only writer.
4. **Degrade gracefully.** If Realtime drops mid-class, the display keeps showing the last slide (never a blank screen) and reconnects automatically. supabase-js already auto-reconnects; on (re)join, the display sends a `sync-request` event and the control replies with the full current state (slide index + whiteboard scene).

## Supabase

- Project region: **sa-east-1 (São Paulo)** — teacher is in Chapecó/SC, Brazil; latency matters for live strokes.
- Free tier is fine (2 devices, a few thousand Realtime messages per class).
- RLS on everything. This app authenticates as the teacher.

## Development phases (build in this order, one at a time)

### Phase 1 — Scaffold, routing, auth
- Vite scaffold, React Router, the two routes rendering placeholders.
- Supabase Auth: email + password login for the teacher (single user for now, but don't hardcode — use RLS with `auth.uid()`).
- Both `/present` and `/control` require an authenticated session. Keep the login flow minimal.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (Supabase's current dashboard issues a `sb_publishable_...` key instead of the legacy anon JWT — same public/client-safe role, new name).

### Phase 2 — Lessons CRUD + slide renderer
- Table `lessons`: `id uuid pk`, `title text`, `content jsonb` (array of blocks), `teacher_notes jsonb` (notes per slide index), `created_at`, `updated_at`. RLS: owner-only.
- Zod schemas in `src/schema/blocks.ts`: start with `slide`, `heading`, `paragraph`, `image`, `list`. Validate `content` on load; fail loudly on unknown block types in dev, render a visible "unsupported block" placeholder in production.
- Slide renderer: pure components mapping block type → JSX. Stage layout (large typography, high contrast) — this is projected on a wall, not read on a phone.
- Simple lesson list page (`/`) to pick a lesson and jump to present/control.
- CRUD can be minimal (lessons will mostly arrive via the Notion→Supabase pipeline later); an edit-JSON-in-a-textarea admin screen is acceptable for now.

### Phase 3 — Realtime sync (navigation + notes)
- Channel per lesson: `lesson:{lessonId}`.
- Events (broadcast):
  - `nav` `{ slide: number }` — control → display
  - `sync-request` `{}` — display → control (on join/rejoin)
  - `sync` `{ slide: number, scene?: ExcalidrawScene }` — control → display
- Control shows: current slide thumbnail, teacher notes for that slide, prev/next buttons (large touch targets — used while walking).
- Display: fullscreen (Fullscreen API), no chrome, subtle "reconnecting…" indicator when the channel drops.

### Phase 4 — Whiteboard (Excalidraw)
- Control route gets a whiteboard tab/mode with two variants: **blank board** and **annotate over current slide** (Excalidraw with transparent background overlaid on the slide).
- Display renders a second Excalidraw instance with `viewModeEnabled` (no toolbar), applying updates via `updateScene()`.
- Sync strategy: listen to Excalidraw's `onChange`, **throttle ~80ms**, broadcast changed elements (not raw pointer strokes). Simpler and more robust than serializing points manually.
- Strip Excalidraw's UI down to pen / eraser / a few colors. Hide everything else.
- **iPad Safari gotchas (important):**
  - `touch-action: none` on the canvas container, or Safari hijacks gestures and strokes stutter.
  - Apple Pencil arrives as Pointer Events with `pointerType: "pen"` and real pressure. Palm rejection = draw only on `pen`, use finger touches for pan/zoom (Excalidraw mostly handles this; verify on device).
  - Test against iPadOS Scribble interference; disable it in the drawing area if it converts strokes to text.
- Whiteboard state is ephemeral in this phase (page reload on the display = ask control for `sync`).

### Phase 5 — Save whiteboard as class material
- At end of class (explicit button, not automatic on every stroke): `exportToBlob()` the board(s) → upload PNG to Supabase Storage bucket `class-materials`, path `{lessonId}/{date}-board-{n}.png`, plus a row in `class_boards` linking lesson ↔ file.
- These become "material de apoio" surfaced to students later via the student app (out of scope here — just make the data land in the right shape).
- Storage may migrate to Cloudflare R2 later; keep upload logic behind a small `storage.ts` module so the swap is one file.

## Brand

Lexicon English visual identity (apply from Phase 2 onward, don't block Phase 1 on it):
- Palette (four tokens, monochromatic): **Mist 100** (background), **Jade 400 `#61B495`** (accent), **Forest 800**, **Ink 950** (text).
- Wordmark: "lexicon" with jade tittle on the "i".
- Presentation surfaces favor huge type and generous whitespace — B2B corporate tone, not playful edtech.

## Conventions

- TypeScript strict. Zod at every boundary (Supabase rows, Realtime payloads, env vars).
- Keep `src/schema/` framework-free (future shared package).
- Small modules over abstractions; this is a solo-dev project optimized for velocity.
- Comments in English; UI copy in English (product language), except where noted.
- After each phase: it must be testable end-to-end on real hardware (Mac browser + iPad Safari) before starting the next.
