# CardNav homepage header — Design

## Purpose

Replace the plain flex `<header>` on the homepage (`src/routes/_authenticated/index.tsx`,
lines 11–20) with an adaptation of the [reactbits CardNav](https://reactbits.dev/components/card-nav)
component: a GSAP-animated pill nav that expands into cards on click.

## Scope

In scope:
- Port the reactbits `CardNav` component into this codebase, restyled with the
  app's existing Tailwind design tokens instead of hardcoded colors.
- Wire it into the homepage with real nav content and the existing user avatar.

Out of scope:
- Applying the header to other routes (`login`, `finances`, `groups`, etc.) —
  only the homepage has a header today.
- Any new functionality behind the avatar (dropdown/menu) — it's a static
  circle today and stays that way.

## Component

New file: `src/components/card-nav.tsx`.

Ported from the reactbits source (fetched from the `react-bits` GitHub repo),
keeping the same behavior:
- 60px collapsed pill; hamburger click plays a GSAP timeline that animates
  height to the expanded content height and staggers the 3 cards in with a
  `y: 50 → 0, opacity: 0 → 1` fade-up.
- Height is recalculated on resize (mobile content height differs from
  desktop's fixed 260px).
- Mobile (`max-width: 768px`): cards stack vertically, logo/hamburger order
  swaps, container shrinks.

Deviations from the reactbits source:
- No separate `.css` file — styling ported to Tailwind utility classes bound
  to this app's CSS variables (`bg-card`, `text-card-foreground`,
  `border-border`, `shadow-lg`, `rounded-xl`) so light/dark mode works
  automatically via the existing `ThemeProvider`, instead of the demo's
  hardcoded `#fff` / `#111` / per-card hex colors.
- Logo renders as text (`lexicon`, `font-display` / Caprasimo — matching the
  current header) instead of an `<img>`, since there's no logo asset in the
  project.
- Nav links use TanStack Router's `Link`, not raw `<a href>`.
- The CTA button slot is replaced by the existing user avatar circle
  (`bg-primary/40 border border-input rounded-full`, "U" initial) — kept
  visible on mobile too (the reactbits demo hides its CTA at `≤768px`; an
  identity element shouldn't disappear).
- Icon: `lucide-react`'s `ArrowUpRight` instead of `react-icons`' `GoArrowUpRight`
  (`lucide-react` is already a dependency; avoids adding a second icon
  library).
- All 3 expanded cards share one subtle background (`bg-muted` or `bg-card`
  with `border-border`) rather than the demo's distinct bright per-card
  accent colors — consistent with the rest of the app's understated palette.

## Nav content

3 cards (reactbits `CardNav` only renders the first 3 of the `items` array):

| Card label | Link            |
|------------|------------------|
| Students   | `/students`      |
| Groups     | `/groups`        |
| Partners   | `/partners`      |

Each card has exactly one link for now (reactbits supports multiple links per
card; not needed yet since each of these routes is a single destination).

## Layout

Floating overlay pill, matching the reactbits demo: `position: absolute`,
centered, `max-width` container near the top of the viewport — not in normal
document flow. The homepage wrapper (`h-svh flex flex-col`) gets `relative`
positioning as the containing block, and the content below gets top padding
so the welcome `<Card>` doesn't sit under the collapsed pill.

## Dependencies

- Add `gsap` (not currently installed) — required for the expand/collapse
  timeline.
- No new icon library — reuse `lucide-react`.

## Files touched

- New: `src/components/card-nav.tsx`.
- Edit: `src/routes/_authenticated/index.tsx` — replace the `<header>` block
  (lines 11–20) with `<CardNav>` configured per the table above, wrap the page
  root in `relative` positioning, add top padding to the content below.
- Edit: `package.json` — add `gsap` dependency.

## Testing

Manual verification only (visual component, no business logic): run the dev
server, click the hamburger to confirm expand/collapse animation and stagger,
click each of the 3 links to confirm navigation, check both light and dark
themes, and check the mobile breakpoint (stacked cards, avatar still visible).
