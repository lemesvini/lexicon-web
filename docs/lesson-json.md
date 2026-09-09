# Authoring lesson JSON

Instructions for generating a lesson document by hand (or with an LLM) that the
Studio, the presenter and the student surfaces will all accept.

Read this **before** writing any lesson JSON. Most of it is a list of values
that are legal and values that are not, because nothing validates a block on the
way in: `parseLesson` (`src/features/studio/model.ts`) checks only that the file
is an object with a `slides` array, then hands the blocks straight to the
renderers. A wrong enum value is not caught at import — it either renders as the
wrong thing or throws and takes the whole page down.

The types are the source of truth: `src/lib/lessons.ts`. If this document and
that file disagree, the file wins and this document is the bug.

---

## The rules that actually break things

Everything else in this document is detail. These are the ones that produce a
broken import or a silently wrong slide.

1. **`color` means two unrelated things.** A `title` block and a `callout` block
   both have a `color` field and they share no values. Putting a callout colour
   on a title block **crashes the render** (`Cannot destructure property
   'background' of TITLE_COLORS[...]`). See [Colour](#colour).
2. **`list` blocks must have `style`.** It is not optional and has no default.
3. **Exercise blocks (`finish-sentence`, `choose-description`, `find-mistake`,
   `long-answer`) need a stable `id`,** and only ever appear in homework. See
   [Which blocks go where](#which-blocks-go-where).
4. **`answer` is an index into `options`, not the answer text.** Zero-based.
   On `find-mistake` there are no `options`: it indexes the sentence's own
   words, split on whitespace.
5. **`image` blocks cannot be authored from scratch.** `path` points at a file
   already uploaded to Supabase Storage. Do not invent one. See [image](#image).
   The same goes for a `post` block's `avatarPath` and `imagePath` — but there,
   leaving the avatar out is fine: the card draws a default user icon.
6. **Write UTF-8.** Portuguese in these lessons is full of accented characters,
   and a file saved as Latin-1 renders as `cafÃ© da manhÃ£` on a projector in
   front of a class. Check with `file -I lesson.json` — you want
   `charset=utf-8`, and no BOM.

---

## The three kinds of document

All three use the same `Lesson` shape and the same importer. What differs is
which blocks belong in them.

| Kind | Where it is used | Blocks allowed |
|---|---|---|
| **Presentation** | Projected in class + the teacher's control device | Everything except exercise blocks |
| **Material** | The student's own copy of the lesson | Same, minus teacher-only content |
| **Homework** | Answered and submitted by the student | Exercise blocks (plus prose blocks around them) |

A material is usually seeded from the presentation and then stripped: teacher
notes and any block marked `audience: "teacher"` are removed, by
`stripTeacherContent` in the client and by the `strip_teacher_content` trigger
in the database (migration `0004`). The database is the guarantee — you do not
have to strip by hand, but you do have to mark correctly.

---

## Skeleton

```json
{
  "id": "B1L2",
  "unit": "Unit One",
  "module": "Book One",
  "title": "[Lesson Two] My Daily Routine",
  "context": "One paragraph for the teacher: what this class is about.",
  "minorCanDo": "Talk about your daily routine and describe what you do at work",
  "grammarFocus": ["Present Simple", "Auxiliary Verbs (do/don't)"],
  "classPlan": [
    { "stage": "Warm-up", "duration": "10", "goal": "Recall last class" }
  ],
  "slides": [
    {
      "id": "1",
      "stage": "Title",
      "duration": "10",
      "goal": "",
      "hideStage": true,
      "blocks": [
        { "type": "title", "color": "jade", "eyebrow": "Lesson Two", "title": "My Daily\nRoutine" }
      ]
    }
  ]
}
```

### Lesson fields

Every one of these is required by the `Lesson` type. Emit all of them, even when
empty — `parseLesson` will fill in a missing one, but a round-trip through the
Studio always writes the full set, so omitting them just makes the first save a
noisy diff.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Lesson slug, e.g. `"B1L2"`. Used as the URL and as the key a material attaches to. |
| `unit` | string | e.g. `"Unit One"` |
| `module` | string | e.g. `"Book One"` |
| `title` | string | Shown in the library table |
| `context` | string | Teacher-facing summary of the class |
| `minorCanDo` | string | The one thing the student can do at the end |
| `grammarFocus` | string[] | Shown as chips in the library |
| `classPlan` | `{stage, duration, goal}[]` | `duration` is minutes as a **string**, e.g. `"10"`. The library sums these into the lesson's total duration, so a non-numeric string counts as zero. |
| `slides` | Slide[] | The document itself |

### Slide fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Free-form. Number the slides as strings (`"1"`, `"2"`) and keep it consistent — an empty `id` is tolerated but reads as an oversight. |
| `stage` | string | The label in the slide header, e.g. `"Vocabulary"` |
| `duration` | string | Minutes for this slide. Display only — the total comes from `classPlan`. |
| `goal` | string | Teacher-facing note on what the slide is for |
| `layout` | `"column"` \| `"row"` | Optional, defaults to `"column"`. `"row"` puts the blocks side by side in equal columns — good for two tables or text next to an image. Two or three blocks maximum; four will not fit on a projector. |
| `hideStage` | boolean | Optional. Drops the stage header. Set it on cover slides. |
| `blocks` | Block[] | See below |
| `teacherNotes` | string[] | Optional. Shown only on the teacher's control device, never projected, and stripped from student documents. Good for drill prompts and answer lines. |

### Full-bleed slides

`title` blocks, `image` blocks with `"wallpaper": true` and `embed` blocks with
`"fill": true` are lifted out of the normal flow and stacked edge to edge **in
the order you wrote them**. Any other
blocks on that slide are laid on top, centred.

That ordering is the mechanism behind a title over a photo:

```json
"blocks": [
  { "type": "image", "path": "images/abc.jpg", "wallpaper": true },
  { "type": "title", "color": "clear", "title": "Small Talk" }
]
```

`color: "clear"` is the only title colour that is a scrim rather than a solid
fill, and it exists for exactly this case.

A slide holding any full-bleed block drops its stage header regardless of
`hideStage`, so setting the flag on a cover slide is redundant — harmless, and
the Studio round-trips it, but it is not what hides the header.

---

## Colour

The single most common authoring error. Two different vocabularies, one field
name, and only one of them fails loudly.

### `title` blocks — `jade` · `forest` · `mist` · `clear`

Defined in `src/features/blocks/title/index.tsx`. **Any other value throws and
breaks the import.** There is no fallback.

| Value | Looks like | Use for |
|---|---|---|
| `jade` | Brand green, light type. The default. | Lesson covers |
| `forest` | Dark green, light type | Section breaks — Drills, Practice |
| `mist` | Pale green, dark type | The closing "Now you CAN DO" slide |
| `clear` | Gradient scrim, light type | A title laid over a wallpaper image |

### `callout` blocks — `blue_bg` · `green_bg` · `yellow_bg` · `gray_bg` · `red_bg`

Defined in `src/features/blocks/callout/index.tsx`. Unknown values fall back to
`blue_bg`, so a mistake here is invisible rather than fatal — which makes it
worth getting right on the first pass.

**Never put a `*_bg` value on a title block, and never put `jade`/`forest`/
`mist`/`clear` on a callout.**

### `email` and `post` blocks — `theme`, not `color`

Defined in `src/features/blocks/email/index.tsx` and
`src/features/blocks/post/index.tsx`. The window's — and the card's — field is
called `theme`, and it is a separate field name precisely so it cannot be
confused with the two lists above: neither block has a `color` at all.

| Value | Looks like | Use for |
|---|---|---|
| `light` | macOS Mail, light. The default. | Almost always — the email as the student meets it |
| `dark` | macOS Mail, dark | An email shown on a dark slide |
| `mist` | Pale green window, dark green type | A branded slide, paired with a `mist` title |
| `forest` | Deep green window, pale type | A branded slide, paired with a `forest` title |

`mist` and `forest` are the brand greens from `src/features/blocks/brand.ts` —
the same two grounds the `title` covers of those names use, which is why they
share the names. Reach for them when the email is a piece of the deck; reach for
`light`/`dark` when it is meant to look like a real email, which is most of the
time.

An unknown value falls back to `light` rather than throwing — the mistake shows
up as a light window in the studio preview instead of a blank slide in class.

A `post` block takes the same four values, with the same meanings and the same
fallback: `light`/`dark` for a card that should look like a real feed, `mist`/
`forest` for one that belongs to the deck.

---

## Markdown

Two renderers, and which one a field gets is fixed per field.

**Inline only** — `**bold**`, `*italic*`, `` `code` ``, `~~strike~~`. Not
nestable. Newlines survive as line breaks. This covers `text.body`,
`list.items[]`, `callout.body`, `table` cells, `dialog` line text,
`image.caption`, `finish-sentence.sentence`, `long-answer.question`.

**Block markdown** — paragraphs, hard line breaks, `#`/`##`/`###` headings, and
`-`/`*`/`+` or `1.` lists, plus all the inline marks. Two fields get this:
`choose-description.text` and `email.body`, because a passage is often an email
or a chat whose own layout is part of what is being read.

**Neither** — `email`'s four header fields (`to`, `cc`, `subject`, `from`) are
printed as typed. An address is not prose and `**bold**` in a To: line would
render as asterisks in the window.

Nothing else is supported anywhere: no links, no tables-in-markdown, no images,
no blockquotes, no nested lists. Write a `table` block instead of a markdown
table.

---

## Block reference

Every block may also carry `"audience": "teacher"` to make it teacher-only. It
will show on the control device and be removed from every student document,
whatever its type.

### title

A cover. Drawn as type, not uploaded as an image, so it re-lays itself on any
screen shape instead of being cropped.

```json
{
  "type": "title",
  "color": "jade",
  "eyebrow": "Lesson Two",
  "title": "My Daily\nRoutine",
  "subtitle": "Present Simple",
  "hideWordmark": false
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | The headline. **`\n` is meaningful** — the type is sized to the longest line, so you control the wrap. Two or three short lines beat one long one. |
| `color` | no | See [Colour](#colour). Defaults to `jade`. |
| `eyebrow` | no | Small line above, e.g. `"Lesson Two"` |
| `subtitle` | no | Quieter line beneath the headline |
| `hideWordmark` | no | Drops the "lexicon" wordmark from the corner |

Put it on its own slide. It fills the slide by itself and suppresses the stage
header on its own.

### text

```json
{ "type": "text", "label": "Warm-up", "body": "Paragraph text.", "note": "Teacher aside" }
```

`body` required. `label` is a small heading above; `note` is a smaller line
below. Inline markdown in `body`.

### list

```json
{ "type": "list", "style": "bullet", "items": ["First", "Second"], "label": "Examples" }
```

`style` and `items` required. **`style` has no default** — one of `"bullet"`,
`"numbered"`, `"checklist"`. Empty strings in `items` are dropped on save.

### callout

```json
{
  "type": "callout",
  "color": "green_bg",
  "icon": "💡",
  "title": "Present Simple — Affirmative",
  "body": "I work in sales\nI deal with clients every day"
}
```

`title` and `body` required. `icon` is a single emoji, rendered as text — an
emoji, not an icon name, and not a digit standing in for one. Newlines in `body`
are kept, which is how a callout holds a short list of example sentences.

### table

```json
{
  "type": "table",
  "label": "Vocabulary",
  "columns": [
    { "title": "In English", "rows": ["Wake up", "Get up"] },
    { "title": "In Portuguese", "rows": ["Acordar", "Levantar"] }
  ]
}
```

`columns` required. **Give every column the same number of rows** — the table is
as tall as its longest column and short ones are padded with blanks, so a
mismatch shows up as empty cells rather than an error. Two or three columns; a
fourth stops being readable at projector distance.

### dialog

```json
{
  "type": "dialog",
  "lines": [
    { "speaker": "Alex", "text": "What do you do for a living?" },
    { "speaker": "You", "text": "I work as a _________." }
  ]
}
```

`lines` required, each with `speaker` and `text`. Lines blank in both fields are
dropped on save. Underscore runs are the convention for a gap the student fills
out loud — this is not the `finish-sentence` exercise block and nothing is
parsed out of it.

### email

```json
{
  "type": "email",
  "theme": "light",
  "to": "reservations@hotelvista.com",
  "subject": "Booking for 12 March",
  "from": "Ana Ribeiro – ana@example.com",
  "body": "Dear Sir or Madam,\n\nI would like to book a double room…\n\nKind regards,\nAna"
}
```

An email drawn as the macOS Mail compose window — a title bar with three
traffic lights, the header rows, the message. Presentation and material only;
the chrome is a picture and none of it does anything.

`body` required (block markdown — blank line between paragraphs). `theme` is
`light`, `dark`, `mist` or `forest`, defaulting to `light`; see
[Colour](#email-and-post-blocks--theme-not-color).

`to`, `cc`, `subject` and `from` are each optional and **each row is drawn only
when it has a value**. Leave `cc` out and the window simply has no Cc line — do
not pass `""` to hide a row, that is what omitting it does.

Use this for reading an email as a class. If the student has to answer a
question *about* the email, that is a `choose-description` block in a homework
document, whose passage takes the same block markdown.

### image

```json
{ "type": "image", "path": "images/6f1c-….png", "alt": "…", "caption": "…", "wallpaper": false }
```

`path` required — an **object path inside the `lesson-images` Supabase Storage
bucket**, not a URL and not a local file. The public URL is derived at render
time.

**You cannot author this block from nothing.** A path that was not produced by
an actual upload resolves to a broken image. Either copy a path from an existing
lesson, or leave the image out and tell the author to add it in the Studio,
which uploads the file and fills the path in. `wallpaper: true` wants 1920×1080.

### embed

A live web page framed on the slide — a video, a map, an interactive.

```json
{ "type": "embed", "url": "https://www.youtube.com/watch?v=…", "title": "Lorde — Team", "aspect": "16:9", "caption": "…" }
```

One of `url` (a page someone else hosts), `path` (one we host — see below) or
`html` (a pasted embed code — see below). When more than one is set, `html` wins,
then `path`, then `url`.
`url` must be absolute `http(s)`; anything else draws an empty frame rather than
a broken one. Share links are rewritten to the publisher's frameable form, so
paste what you copied:

| Pasted | Framed |
|---|---|
| `youtu.be/<id>`, `youtube.com/watch?v=<id>`, `/shorts/<id>` | `youtube.com/embed/<id>` (a `t=90s` cue point is kept) |
| `vimeo.com/<id>` | `player.vimeo.com/video/<id>` |
| anything else | exactly as written |

`aspect` is `"16:9"` (default) · `"4:3"` · `"1:1"` · `"3:4"`. There is no height
field: the frame is a ratio so the same block fits a projector, a preview card
and a phone. `"fill": true` gives the embed the whole slide instead (see
[Full-bleed slides](#full-bleed-slides)) and makes `aspect` moot; in a student's
material, a page rather than a stage, a filling embed falls back to 16:9 in the
column.

**Many pages refuse to be framed.** `X-Frame-Options` or a `frame-ancestors`
policy is the publisher saying no, and there is nothing to be done from our side
— the frame comes up blank or says "refused to connect". Always check an embed on
the presenter before the lesson.

**Claude artifacts are one of those.** They are served with
`frame-ancestors 'self' *.anthropic.com claude.com …`, so an artifact URL cannot
be framed from our domain no matter which form of it you use. Do this instead:

1. Open the artifact and save the page (or export its HTML).
2. In the Studio, on an `embed` block, click **Upload a page (.html)**.
3. The file goes to the `lesson-embeds` bucket and the block stores its object
   path in `path`, which then takes precedence over `url`.

```json
{ "type": "embed", "path": "pages/6f1c-….html", "title": "What we have in common" }
```

`path` is a real upload, exactly like `image.path` — **you cannot author it from
nothing.** An invented path frames an empty box.

The page is read back out of storage and handed to the iframe as markup, not
pointed at by address: Storage does not serve user-uploaded HTML as `text/html`,
and an iframe pointed straight at the file renders the source code on the slide.
Two consequences worth knowing:

- The file must be **self-contained**. A page that pulls in a sibling `style.css`
  it was saved next to has no address to resolve it against and will come up
  unstyled. Fonts, images and scripts on absolute `https://` URLs are fine.
- Uploaded pages are sandboxed without `allow-same-origin`, so a page that
  expects `localStorage` will find it throws. That is deliberate — a `srcdoc`
  document otherwise inherits the Studio's own origin.

**Embed codes: `html`.** X/Twitter, Instagram, TikTok, CodePen and friends do not
publish a framable address at all — they hand out a *snippet*, a piece of markup
plus the script that turns it into the card:

```json
{
  "type": "embed",
  "html": "<blockquote class=\"twitter-tweet\"><p lang=\"en\" dir=\"ltr\">millie just keeps rubbing it in his face</p>&mdash; someone (@someone) <a href=\"https://x.com/someone/status/207…\">July 2, 2026</a></blockquote> <script async src=\"https://platform.x.com/widgets.js\" charset=\"utf-8\"></script>",
  "caption": "What does *rub it in* mean here?"
}
```

Paste the code exactly as the site gives it — script tag included; that tag is
the half that does the work. In the Studio it goes in the box under the URL
field, and pasting it *into* the URL field works too: a value that starts with
`<` is filed as `html` rather than saved as an address that could never load.

**The snippet's script is not what renders it.** A pasted `widgets.js` cannot
work from here — it needs its own origin to build the card, and it does not get
one inside our frame. So the snippet is read rather than run: the id is taken out
of the markup and the publisher's *own* embed page is framed at the publisher's
origin, which is the same page the script would have built.

| Pasted | Framed |
|---|---|
| an `<iframe src="…">` (CodePen, Spotify, a map) | that `src`, at its own stated height |
| an X / Twitter blockquote | `platform.twitter.com/embed/Tweet.html?id=…`, in the app's light or dark theme |
| an Instagram blockquote | `instagram.com/p/<code>/embed/captioned/` |
| a TikTok blockquote | `tiktok.com/embed/v2/<id>` |
| anything else | the snippet itself, in a sandboxed document of ours |

Two things behave differently for `html` than for the other two:

- **It has no `aspect`.** A tweet is as tall as it is, and a card in a 16:9 box
  is a card with an empty field either side of it. X and Instagram report their
  height to the frame and it follows them; the others use the height they state.
  The frame is also capped at the card's own width and centred — a tweet is a
  550px column, and in a frame wider than that it lays itself against the left
  edge and reads as crooked. `"fill": true` still works and still means the whole
  slide.
- **A snippet from somewhere unrecognised** falls back to being run in a
  sandboxed document without `allow-same-origin`, which is enough for static
  markup and for most widgets, but not for one that insists on `localStorage` or
  on being logged in. Check it on the presenter before the lesson, as with any
  embed. If it will not cooperate at all, the fallback is the `post` block, which
  draws the card ourselves.

---

### post

A social post — a tweet, an Instagram post — drawn as the card it would be seen
in. Same reasoning as `email`: the shape around the words is half of what is
being read.

```json
{
  "type": "post",
  "theme": "light",
  "displayName": "Marina Alves",
  "username": "marina.climbs",
  "avatarPath": "images/6f1c-….png",
  "body": "First time on real rock this weekend. My arms are **dead** but I'd do it again tomorrow.",
  "imagePath": "images/9a20-….jpg",
  "imageAlt": "A climber on a granite face"
}
```

`username` and `body` are the only required fields, and `body` may be `""` on a
post that is only a photo. The `@` is drawn, so write the handle with or without
it — `"marina.climbs"` and `"@marina.climbs"` come out the same.

`displayName` is optional; leave it out and the card shows the handle alone.

`avatarPath` and `imagePath` are **object paths in the `lesson-images` bucket,
exactly like `image.path` — a real upload, never invented.** An invented one
draws a broken picture. Leaving `avatarPath` out is not a defect: the card falls
back to the default user icon, which is what a real account with no picture
looks like. Upload both in the Studio, which fills the paths in.

`body` is block markdown. `theme` is `light`, `dark`, `mist` or `forest`,
defaulting to `light`; see [Colour](#email-and-post-blocks--theme-not-color).

The card is a still picture: no like, reply or share buttons, because none of
them would do anything. If the student has to answer a question *about* the
post, that is a `choose-description` block in a homework document, whose passage
takes the same block markdown.

---

## Exercise blocks (homework only)

These are the blocks a student answers. They do not belong in a presentation or
a material — neither surface can submit an answer.

Two rules apply to all three:

- **`id` is required, and permanent.** A submission is stored as a map from
  block id to answer, so changing an id orphans every answer already given.
  Generate a UUID. When editing an existing homework, never renumber or reuse.
- **`answer` is a zero-based index into `options`.** It is present in the
  teacher's copy and stripped from the student's by the `student_homework` view.
  Do not remove empty options to tidy up — the index would repoint at the wrong
  one.

### finish-sentence

```json
{
  "type": "finish-sentence",
  "id": "3f2b1c4d-…",
  "sentence": "I ___ at 7 am every day.",
  "options": ["wake up", "wakes up", "waking up", "woke up"],
  "answer": 0
}
```

The gap is exactly three underscores, `___`. **Only the first one is the gap** —
any others render as literal text, because one gap per sentence is what keeps
the answer a single index. Four options is the usual shape.

### choose-description

```json
{
  "type": "choose-description",
  "id": "…",
  "text": "Hi Sarah,\n\nI'm writing about Monday's meeting.\n\nBest,\nTom",
  "font": "mono",
  "options": ["Tom está remarcando a reunião.", "Tom está confirmando a reunião."],
  "answer": 1
}
```

A passage in English, and descriptions of it **in the student's own language**.
`text` takes block markdown. `font` is `"sans"` (default) or `"mono"` — use
`mono` when the passage's own layout is part of the reading: an email, a chat, a
form. Three options is the usual shape.

### find-mistake

```json
{
  "type": "find-mistake",
  "id": "…",
  "sentence": "She go to school every day.",
  "answer": 1
}
```

One sentence with exactly one wrong word in it; every word is clickable and the
student clicks the wrong one. There is no `options` array — the words *are* the
options, so `answer` indexes `sentence.split(/\s+/)`: `0` is `She`, `1` is `go`,
and `6` is `day.` Punctuation travels with the word it is attached to.

Count the index by hand against the whitespace-split words, and recount it after
any edit to the sentence — inserting a word before the mistake shifts the key.
No inline markdown here: the words are drawn as chips, not as prose.

### long-answer

```json
{
  "type": "long-answer",
  "id": "…",
  "question": "Describe your daily routine.",
  "hint": "3–5 sentences"
}
```

Free text, marked by hand. No `answer` and no `options`. `hint` sets the
expectation of length or shape.

---

## Building a lesson

A presentation that works in a real class usually runs:

1. **Cover** — `title` on `jade`, `hideStage: true`
2. **Minor Can Do** — a `text` framing the goal, then a `dialog` with gaps, so
   the class hears the target language before analysing it
3. **Vocabulary** — one or two `table` blocks, English against Portuguese;
   `layout: "row"` when there are two
4. **Grammar** — `callout` blocks for the pattern, then a `table` for the full
   conjugation
5. **Examples** — a `list` of model sentences
6. **Drills** — a `forest` `title` as a section break, with the prompts in the
   slide's `teacherNotes` where only the teacher sees them
7. **Close** — a `mist` `title`, "Now you CAN DO"

Keep it to one idea per slide. A slide is read at projector distance by someone
who is also listening to a teacher, so a table of six rows is near the ceiling
and a `text` block longer than three lines will not be read at all.

---

## Before handing the file over

- [ ] Valid JSON — `python3 -m json.tool lesson.json > /dev/null`
- [ ] UTF-8, no BOM — `file -I lesson.json` says `charset=utf-8`; no `Ã` or `â`
      anywhere in the file
- [ ] Every `title` block's `color` is `jade`, `forest`, `mist` or `clear`
- [ ] Every `callout` block's `color` ends in `_bg`
- [ ] Every `list` block has a `style`
- [ ] Every `table` block's columns have equal row counts
- [ ] Every exercise block has a unique `id`, and `answer` indexes into
      `options` (0-based, in range) — or, on `find-mistake`, into the
      sentence's whitespace-split words
- [ ] No exercise blocks in a presentation or material; no `image` block with an
      invented `path`, and no `post` block with an invented `avatarPath` /
      `imagePath`
- [ ] Top-level `id`, `unit`, `module`, `title`, `context`, `minorCanDo`,
      `grammarFocus`, `classPlan`, `slides` all present
- [ ] Answer keys and drill prompts are behind `teacherNotes` or
      `audience: "teacher"`

Then import it: Studio → open the JSON file, or the presenter menu's "open from
file", or paste it into the Studio's raw JSON drawer. All three call
`parseLesson`, so all three fail the same way on the same file.
