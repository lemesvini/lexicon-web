# Studio guide

How to build a deck in the Studio: what a slide can do, every option it offers,
and how those options combine. This is the guide for the person *using* the
editor. The JSON behind it is documented in [lesson-json.md](lesson-json.md);
the two describe the same things from opposite sides.

---

## 1. The three things the Studio edits

Everything in the Studio is the same shape underneath — a document with some
metadata and a list of slides made of blocks — but each kind is read by someone
different, and that changes what it can hold.

| Kind | Who sees it | Where | What it can hold |
|---|---|---|---|
| **Presentation** | The room, on the projector; the teacher, on the control device | `Present` / `Control` | Every presentation block. Teacher notes and teacher-only blocks stay on the control device. |
| **Student material** | The student, on their own device, as a page and as a deck | `Learn` | Every presentation block. Teacher content is stripped on save — you can't accidentally publish an answer key. |
| **Homework** | The student, answered and handed in | `Homework` | Exercise blocks, plus prose blocks around them. |
| **Advanced context** | One group | The group's page | A group's own copy of a presentation. Base slides are locked; the group's additions are editable. |

The first three are created from the Library's **Create** button. Advanced
context is never created there — a copy exists because a group was given a
module, and you open it from that group.

### The Library

The Library is the front door: one tab per kind, each a table (or a gallery —
toggle at the top right). A row opens in the editor with **Edit**; the **⋯**
menu on a row publishes / unpublishes it or deletes it. Publishing is what
makes a material or a homework visible to students; a presentation is always
available to present.

---

## 2. The editor

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Library            Studio · Presentation            ⋯  ☁  ✦    │  toolbar
├──────────┬───────────────────────────────────────────────────────┤
│ Slides   │  Document metadata (title, id, module, …)             │
│  1 Warm  │ ┌───────────────────────────────────────────────────┐ │
│  2 Vocab │ │ 1  Stage name                            ▦  ⋯     │ │  slide header
│  3 Prac  │ │    id · ⏱ · goal                                  │ │
│          │ ├───────────────────────────────────────────────────┤ │
│ + Add    │ │  ┌───────────── preview (16:9) ─────────────┐     │ │
│          │ │  └───────────────────────────────────────────┘     │ │
│          │ │  [ block ]                                         │ │
│          │ │  [ block ]                                         │ │
│          │ │  ┄┄┄┄┄┄┄┄┄┄┄┄ + Add block ┄┄┄┄┄┄┄┄┄┄┄┄┄          │ │
│          │ │  Teacher notes                                     │ │
│          │ └───────────────────────────────────────────────────┘ │
│          │  + Add slide                                          │
└──────────┴───────────────────────────────────────────────────────┘
```

### Toolbar

Three buttons, left to right:

- **⋯ menu**
  - *Slide previews* — draw the 16:9 picture above each slide's fields. Off
    gives you a compact list for a laptop. Remembered across sessions.
  - *JSON* — opens the raw document in a side drawer. You can edit it there
    and apply; this is how a document written by hand (or by an LLM) gets in.
  - *Lexicon wordmark on slides* — the deck-wide default for the
    "lexicon / English" mark at the top of every slide. A slide can override
    it (see [Wordmark](#wordmark)).
  - *Copy* / *Export* — the document as JSON, to the clipboard or as a file.
    Not offered on a group's copy: a file called `situation-one.json` that is
    actually one class's version of it is a trap.
  - Kind-specific items: **Open situation** and **Import JSON file** on a
    presentation; **Copy from presentation** and **Publish** on a material;
    **Publish** on a homework; **Refresh from base** on an advanced context
    whose base lesson has moved on.
- **☁ Save** — to the cloud. Saving is never automatic.
- **✦ Agent** — only on an advanced context: opens the LexStudio Agent drawer,
  which proposes slides for that group from its students' notes and homework.
  Nothing it proposes is applied until you insert it.

### The outline rail

The deck as a jump list, on the left. Click a slide to scroll to it; the block
count sits at the right of each row. **Add slide** at the bottom inserts after
the slide you're on.

### Document metadata

Above the slides. What's here depends on the kind:

- **Presentation**: title, lesson id (the URL and the key a material attaches
  to), module (picked from the ones that exist — a typo would file the lesson
  where no student is looking), unit, context (teacher-facing), minor can-do,
  grammar focus tags, and the class plan (stage / minutes / goal rows — the
  Library sums the minutes into the lesson's duration).
- **Student material**: the lesson it belongs to and an intro line written
  for the student.
- **Homework**: title, id, the lesson it attaches to, and instructions.

---

## 3. A slide

### The header

| Field | What it does |
|---|---|
| **Stage name** | The slide's title. Drawn as the big green heading on the stage, unless hidden (see [Stage title](#stage-title)). Also the row in the outline. |
| **id** | Free-form. Keep it consistent (`"1"`, `"2"`, …). |
| **⏱ duration** | Minutes, display only. Teacher content — not on materials or homework. |
| **goal** | What the slide is for. Teacher content. |

Two buttons on the right:

- **▦ Layout** — every option about how the slide is laid out. Detailed in
  the next section.
- **⋯ Slide menu** — *Move up*, *Move down*, *Duplicate*, *Delete slide*.
  Duplicate copies the blocks and mints fresh ids on any exercise block, so
  two questions never share the same answers.

On a **locked** base slide in an advanced context, neither button appears —
everything in them would change the shared lesson. You can still add blocks
under it, and those are yours.

### The preview

The slide exactly as the room will see it — the presenter's own layout at the
projector's size, scaled down. It's drawn from the teacher's point of view, so
teacher-only blocks show here even though they won't project. What you check
in the preview is how the blocks *land*: whether the text wraps, whether the
row fits, whether the content sits where you meant it to.

### Blocks and the add bar

Blocks are edited in place, in order. Hover a block for its toolbar:

- **Teacher** — marks the block teacher-only. It shows on the control device
  and in the preview, never on the projector, and is stripped from every
  student document. Not offered on materials or homework.
- **Wallpaper** — only on an image: fill the slide with it as a background.
- Move up / down, duplicate, delete.

**+ Add block** under the last block is the one place a block is added from.
It always adds at the end; move it up afterwards.

### Teacher notes

Under the blocks, on presentations and advanced contexts. Bullet lines shown
only on the control device. Good for drill prompts, answer lines, and the
sentence you always forget to say.

---

## 4. Layout: everything the ▦ button offers

The Layout popover has four controls. They're independent — any combination is
legal — and this section walks through each, then through the combinations
worth knowing.

### Position

A 3×3 grid the shape of the stage. Click a cell and the content column moves
there.

```
   left      center     right
 ┌───────┬───────────┬───────┐
 │  ●    │     ●     │    ●  │  top
 ├───────┼───────────┼───────┤
 │  ●    │     ◉     │    ●  │  middle   ← default
 ├───────┼───────────┼───────┤
 │  ●    │     ●     │    ●  │  bottom
 └───────┴───────────┴───────┘
```

Vertical is `align` (`top` / `middle` / `bottom`), horizontal is `justify`
(`left` / `center` / `right`). The stage title follows the horizontal choice:
centred content gets a centred heading, left content a left one.

When to leave the middle:

- **Top-left** — a slide with a short goal or a single instruction. Centred, a
  two-line sentence floats in a sea of empty stage; anchored to the corner it
  reads like the heading of a page.
- **Top-center** — a stage title over a tall block (a long table, a dialog)
  that would otherwise push the heading off the top.
- **Bottom** — a caption-like line under a wallpaper photo.

The content column is padded the same on every side, so "middle" is the middle
of the stage, not of what's left under the wordmark.

### Blocks: Stack / Side by side

How the slide's blocks are arranged.

- **Stack** (`column`, default) — one under the other, full width.
- **Side by side** (`row`) — equal columns, top-aligned. The content column is
  wider in this mode (the stage's full usable width) so two or three blocks
  have room. Four will not fit on a projector.

A row is one axis. For a column *inside* a row, use a
[Container](#container) block — see [Combinations](#combinations).

### Stage title

Show or hide the big heading. Hide it on cover slides (the title block has its
own headline) and on slides that are one full-bleed image or embed.

A slide with an empty stage name draws no heading either way.

### Wordmark

The "lexicon / English" lockup at the top of the stage. Three settings:

- **Deck** — follow the toolbar's *Lexicon wordmark on slides* setting. The
  default, and the right choice for almost every slide.
- **Show** — on, even if the deck's setting is off.
- **Hide** — off, even if the deck's setting is on.

Regardless of the setting, the wordmark is dropped on an **Advanced Context**
slide that wears the mark — that lockup already carries the brand, and two of
them is one too many. The title block also has its own *hide wordmark* switch
for the cover, separate from this one.

---

## 5. The blocks

### Presentation blocks

Available on presentations, materials and advanced contexts.

| Block | What it is | Options |
|---|---|---|
| **Title** | A full-screen cover: eyebrow, headline, subtitle on a flat brand colour. Takes the whole stage. | Colour: *Jade*, *Forest*, *Mist*, *Over image* (a scrim, for use over a wallpaper). Hide the cover's own wordmark. Line breaks in the headline are where it wraps. |
| **Now You Can** | The closing slide: a light card on a coloured ground, with "Now you can", the lesson's minor can-do and a "Thank you · See you next class" footer on the left and the *now you CAN* badge on the right. Takes the whole stage. | Colour of the ground around the card: *Jade*, *Forest* (default), *Mist*, *Over image*. The card is always light. Eyebrow and can-do are filled in from the lesson's title and minor can-do when the block is added — edit either freely. |
| **Text** | A paragraph with an optional label above and note below. | Label (small green eyebrow), body (inline markdown: `**bold**`, `*italic*`), note (quiet italic aside). |
| **List** | Items with a marker. | Style: *Bullet*, *Numbered*, *Checklist* — required, no default. **Cards**: each item in its own tinted box; an item with a line break becomes a heading over a body, which is the shape for a set of steps or rounds. Label, note. |
| **Callout** | A boxed note with an icon in a circle. | Colour: *Blue*, *Green* (the brand green), *Yellow*, *Gray*, *Red*. Icon: one emoji. Title, body. |
| **Table** | Columns of phrases. | Column titles (drawn as a small uppercase header row), cells. Column-major: add a column, then fill its rows. Label, note. |
| **Dialog** | A speaker / line exchange. | Speaker and text per line. Label, note. |
| **Email** | A message drawn as a Mail compose window. | Theme: *Light*, *Dark*, *Mist*, *Forest*. To, Cc, Subject, From — each row drawn only when filled. Body keeps paragraphs. |
| **Post** | A social post drawn as a card. | Theme: same four. Username (with or without `@`), display name, avatar (an upload), body, photo (an upload) with alt text. |
| **Image** | An uploaded picture with optional caption. | Alt text, caption. **Wallpaper** (from the block's hover toolbar): fill the slide; Full HD recommended. |
| **Embed** | A live web page in a frame — a video, a map, an interactive, a tweet. | Source: a URL (share links are rewritten to their player where known), an uploaded HTML page (for sites that refuse to be framed, like a Claude artifact), or a pasted embed snippet. Aspect: *16:9*, *4:3*, *1:1*, *3:4*. **Fill**: take the whole stage. Caption. |
| **Container** | A group of blocks laid out along its own axis. | Direction: *Column* / *Row*. Cross-axis: *Top* / *Center* (row) or *Left* / *Center* (column). Gap: *Tight* / *Normal* / *Loose*. Children are added from its own **Add to container** menu, which offers every presentation block except Title and Now You Can, plus a nested container. |

### Exercise blocks

Available on homework only. Each carries a stable id (minted on creation) that
a student's answer is keyed by — which is why duplicating one mints a new id.

| Block | What the student does | Options |
|---|---|---|
| **Finish the sentence** | Picks the word for a gap. | Sentence with `___` for the gap, options, the right one marked. |
| **Choose the description** | Reads a passage, picks the description that matches. | Passage (block markdown; *mono* font for anything whose own layout is part of the reading — an email, a chat), options in the student's language, the right one marked. |
| **Find the mistake** | Clicks the wrong word in a sentence. | Sentence; the wrong word marked by clicking it in the editor. |
| **Written answer** | Writes in their own words. Marked by hand. | Question, a hint on the expected shape ("3–5 sentences"). |

The answer key never reaches the student — the database strips it on the way
out — so mark the right answer in the editor without worrying about it.

---

## 6. Combinations

The ways a slide's parts fit together, from the plain to the layered.

### One block, centred

The default. A text, a list, a callout — middle of the stage, stage title
above it. No layout changes needed.

### One short block, top-left

Position → top-left. For a goal, an instruction, a single question. The stage
title sits above it as a heading and the empty stage below is the room's to
fill.

### Two blocks side by side

Blocks → *Side by side*. Text next to an image, two tables, a dialog next to a
callout. Each gets half the width; they're top-aligned, so a short block sits
level with the top of a tall one.

### A column inside a row

Blocks → *Side by side*, and one of the two blocks is a **Container** set to
*Column*. Inside it, a text over a list, or a callout over a table:

```
┌───────────────────────────┬──────────────────────┐
│ Container (column)        │ Image                │
│  ┌──────────────────────┐ │                      │
│  │ Text: today's goal   │ │                      │
│  └──────────────────────┘ │                      │
│  ┌──────────────────────┐ │                      │
│  │ List (cards)         │ │                      │
│  └──────────────────────┘ │                      │
└───────────────────────────┴──────────────────────┘
```

The reverse is just as legal: a *Stack* slide with a **Container** set to
*Row* in the middle of it, for a heading over two side-by-side lists over a
closing callout. Containers nest, so a row inside a column inside a row is
allowed — but two levels is usually as deep as a slide can go and still be
readable from the back of the room.

### Steps or rounds

A **List**, *Numbered*, **Cards** on. Write each item as a title, a line
break, and a body. Each becomes a tinted card with the number in a circle. This
is the shape for "round one / round two / round three" or a procedure.

### A cover

A **Title** block, alone. Hide the stage title (the cover has its own
headline). Pick a colour. Position and direction don't apply — the cover takes
the whole stage.

### The closing slide

A **Now You Can** block, alone, as the last slide. Fill in the lesson's
*minor can-do* in the document metadata **before** adding it — the block copies
it (and the lesson title, into the eyebrow) at the moment it is added, and
doesn't follow later edits. Pick the ground colour; *Forest* is the default.

### A title over a photo

An **Image** with *Wallpaper* on, then a **Title** with colour *Over image*,
in that order. Full-bleed blocks stack in the order they're written; the
title's scrim keeps the headline readable over any photo. Hide the stage
title.

### Content over a photo

An **Image** with *Wallpaper* on, then ordinary blocks. The wallpaper fills the
stage and the rest of the blocks are laid on top, at whatever position you
pick. Bottom-left with a single callout reads like a captioned photograph.

### A full-screen embed

An **Embed** with *Fill* on, alone. A video, a map, an interactive the room
uses during the lesson. Hide the stage title.

### A slide with a teacher's aside

Any of the above, plus one block marked **Teacher**: the answer key under a
table, the drill prompt under a dialog. It shows in the preview with an amber
frame, on the control device in full, and nowhere else. Keep teacher-only
blocks at the top level of the slide — one inside a container is hidden from
the room but not stripped from a student document.

### A group's own slide

In an advanced context, a slide you added carries the Advanced Context mark in
its top-left corner. Click the *Advanced · marked* badge in the header to
switch it to *Normal slide* — still yours, still editable, still carried over
when the base lesson is refreshed, just not announced as an aside.

---

## 7. What is *not* a combination

A few things look like they should work and don't, by design:

- **A title or a Now You Can inside a container.** Both own the stage; they
  have no meaning in a column. The container's menu doesn't offer them.
- **An exercise inside a container.** Answers are keyed from the top of the
  homework. Exercise blocks aren't offered on presentations at all.
- **Four blocks side by side.** Nothing stops you; the projector will.
- **A wallpaper without anything on it.** Legal, but it's an image slide with
  extra steps — use a plain Image block with a caption.
- **Two wallpapers.** They stack; the last one wins.

---

## 8. Saving, publishing, presenting

- **Save** writes to the cloud. Nothing autosaves; the toolbar's cloud icon
  turns into a check when it's done.
- **Publish** (materials and homework) makes the document visible to students.
  Save first — the menu item says so if you haven't.
- **Present** opens the projector view; **Control** opens the teacher's
  device, with the current slide, teacher notes, teacher-only blocks and the
  whiteboard. Presenting *for a group* shows that group's advanced context.
- **Export** / **Import JSON** move a presentation as a file. The JSON is
  documented in [lesson-json.md](lesson-json.md); the same import accepts a
  file written by hand or by an LLM, and nothing validates it on the way in,
  so read that document before writing one.
