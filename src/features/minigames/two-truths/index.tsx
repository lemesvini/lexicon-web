import { useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameToast } from "../game-toast";
import {
  GameButton,
  type GameProps,
  GameHeader,
  GameLinkButton,
  GamePaper,
} from "../game-ui";
import {
  GUEST_SHEET,
  GuestColumn,
  GuestFigure,
  GuestStage,
  SHEET_HEADING,
} from "../guest-stage";
import { useArmed } from "../use-armed";
import { useGameState } from "../use-game-state";
import {
  MAX_GUESTS,
  cleared,
  filled,
  freshTwoTruths,
  newGuest,
  parseTwoTruths,
  pick,
  withGuest,
  type Guest,
} from "./model";

// Layout: the Who Am I stage without the plate above the head — three statement
// cards need the height — so the nametag on the chest, a frosted sheet holding
// the cards, and under it one line saying where the turn is, then Right / Wrong.

/** The game's red: a lie, and "Fooled us!". Its own colour rather than the app's
 *  destructive token, which is a shade too dark to read as a verdict on a
 *  projector. */
const DANGER_FILL =
  "border-[#9B2C2C] bg-[#9B2C2C] text-white dark:border-[#E26D5F] dark:bg-[#E26D5F] dark:text-[#0E1412]";
/** Jade with the brand's ink on it: a caught lie, a true statement. */
const JADE_FILL = "border-ring bg-ring text-[#0E1412]";

export function TwoTruths({ scope, lead }: GameProps) {
  const { state, commit, undo, canUndo } = useGameState(
    "two-truths",
    scope,
    parseTwoTruths,
    freshTwoTruths,
  );
  const { show, toast } = useGameToast();
  /** The statement being typed, as "<guest id>:<index>". */
  const [editing, setEditing] = useState<string | null>(null);
  const [armed, setArmed] = useArmed();

  const caught = state.guests.filter((g) => g.result === "right").length;
  const fooled = state.guests.filter((g) => g.result === "wrong").length;

  function update(id: string, change: (g: Guest) => Guest, undoable = true) {
    commit(withGuest(state, id, change), { undoable });
  }

  function onStatement(g: Guest, k: number, value: string | null) {
    setEditing(null);
    if (value === null) return;
    const v = value.replace(/\s+/g, " ").trim();
    const statements = g.statements.map((s, j) =>
      j === k ? v : s,
    ) as Guest["statements"];
    if (v !== g.statements[k])
      update(g.id, (x) => cleared({ ...x, statements }));
    // Straight on to the next blank one, so three statements are typed in one go.
    if (v) {
      const next = statements.findIndex((s) => !s.trim());
      if (next >= 0) setEditing(`${g.id}:${next}`);
    }
  }

  function onCard(g: Guest, k: number) {
    if (!g.statements[k].trim()) return setEditing(`${g.id}:${k}`);
    if (!g.result && !filled(g))
      return show("Fill in all three statements first.");
    const picked = pick(g, k);
    if (picked) update(g.id, () => picked.next, picked.undoable);
  }

  return (
    <GamePaper>
      <div className="flex min-h-full flex-col gap-[18px] px-[22px] pt-[18px] pb-7">
        <GameHeader
          lead={lead}
          title="Two Truths, One Lie"
          subtitle="Each player says three things about themselves. The class points at the lie."
        >
          <div className="flex flex-wrap items-center gap-3.5">
            {(caught > 0 || fooled > 0) && (
              <div
                aria-live="polite"
                className="flex gap-1.5 text-xs font-bold tabular-nums"
              >
                <span className="rounded-full border bg-card px-2.5 py-1 text-primary">
                  Caught {caught}
                </span>
                <span className="rounded-full border bg-card px-2.5 py-1 text-[#9B2C2C] dark:text-[#E26D5F]">
                  Fooled {fooled}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <GameButton
                disabled={!canUndo}
                onClick={() => {
                  if (!undo()) return;
                  setEditing(null);
                  setArmed(null);
                  show("Undone.");
                }}
              >
                Undo
              </GameButton>
              <GameButton
                primary
                onClick={() => {
                  commit({
                    guests: state.guests.map((g) => ({
                      ...cleared(g),
                      statements: ["", "", ""],
                    })),
                  });
                  setEditing(null);
                  setArmed(null);
                  show("New round. Names kept, statements cleared.");
                }}
              >
                New round
              </GameButton>
            </div>
          </div>
        </GameHeader>

        <GuestStage
          count={state.guests.length}
          max={MAX_GUESTS}
          onAdd={() => commit({ guests: [...state.guests, newGuest()] })}
        >
          {state.guests.map((g, i) => (
            <GuestCard
              key={g.id}
              guest={g}
              index={i}
              editing={
                editing?.startsWith(`${g.id}:`)
                  ? Number(editing.slice(g.id.length + 1))
                  : null
              }
              armed={armed === g.id}
              removable={state.guests.length > 1}
              onPlayer={(player) => update(g.id, (x) => ({ ...x, player }))}
              onCard={(k) => onCard(g, k)}
              onEdit={(k) => setEditing(`${g.id}:${k}`)}
              onStatement={(k, value) => onStatement(g, k, value)}
              onVerdict={(result) =>
                update(g.id, (x) => ({
                  ...x,
                  result,
                  // Right: the guess was the lie. Wrong: the player shows it.
                  lie: result === "right" ? x.guess : null,
                }))
              }
              onGuessAgain={() => update(g.id, cleared)}
              onRemove={() => {
                if (armed !== g.id) return setArmed(g.id);
                commit({ guests: state.guests.filter((x) => x.id !== g.id) });
                setArmed(null);
                show("Removed. Undo brings them back.");
              }}
            />
          ))}
        </GuestStage>
      </div>
      {toast}
    </GamePaper>
  );
}

function GuestCard({
  guest: g,
  index,
  editing,
  armed,
  removable,
  onPlayer,
  onCard,
  onEdit,
  onStatement,
  onVerdict,
  onGuessAgain,
  onRemove,
}: {
  guest: Guest;
  index: number;
  /** Which statement is being typed, if any. */
  editing: number | null;
  armed: boolean;
  removable: boolean;
  onPlayer: (player: string) => void;
  onCard: (k: number) => void;
  onEdit: (k: number) => void;
  /** The typed statement, or `null` when abandoned with Escape. */
  onStatement: (k: number, value: string | null) => void;
  onVerdict: (result: "right" | "wrong") => void;
  onGuessAgain: () => void;
  onRemove: () => void;
}) {
  const ready = filled(g);
  // Statements can be picked while the class is guessing, and again after a
  // "wrong", to show the real lie.
  const pickable = (ready && !g.result) || g.result === "wrong";
  const undecided = g.guess === null || g.result !== null;

  // Where this guest's turn is. The verdicts are said in their own colour —
  // this line is all that is left of the plate the original drew above the head.
  const note: { text: string; className?: string } =
    g.result === "right"
      ? { text: "Caught the lie!", className: "font-bold text-primary" }
      : g.result === "wrong"
        ? {
            text:
              g.lie === null
                ? "Fooled us! Tap the real lie to show it."
                : "Fooled us!",
            className: "font-bold text-[#9B2C2C] dark:text-[#E26D5F]",
          }
        : g.guess !== null
          ? { text: `The class says number ${g.guess + 1}. Right?` }
          : ready
            ? { text: "Tap the statement the class chose." }
            : { text: "" };

  return (
    <GuestColumn
      label={g.player || `Player ${index + 1}`}
      className="w-[clamp(220px,20cqw,280px)]"
    >
      <GuestFigure player={g.player} index={index} onPlayer={onPlayer}>
        <div className={cn(GUEST_SHEET, "p-3")}>
          <h2 className={cn(SHEET_HEADING, "mx-0.5")}>Statements</h2>
          {g.statements.map((text, k) =>
            editing === k ? (
              <StatementInput
                key={k}
                index={k}
                value={text}
                onCommit={(value) => onStatement(k, value)}
              />
            ) : (
              <Statement
                key={k}
                guest={g}
                index={k}
                pickable={pickable}
                onClick={() => onCard(k)}
                onEdit={() => onEdit(k)}
              />
            ),
          )}
        </div>
      </GuestFigure>

      <div className="flex w-full flex-col items-center gap-1.5">
        <p
          role="status"
          className={cn(
            "m-0 min-h-[18px] text-center text-xs text-muted-foreground",
            note.className,
          )}
        >
          {note.text}
        </p>
        <div className="flex w-full gap-2">
          <GameButton
            aria-label="The class was right"
            disabled={undecided}
            onClick={() => onVerdict("right")}
            className={cn(
              "flex-1",
              !undecided && cn(JADE_FILL, "hover:bg-ring hover:brightness-110"),
            )}
          >
            Right
          </GameButton>
          <GameButton
            aria-label="The class was wrong"
            disabled={undecided}
            onClick={() => onVerdict("wrong")}
            className={cn(
              "flex-1",
              !undecided && cn(DANGER_FILL, "hover:brightness-110"),
            )}
          >
            Wrong
          </GameButton>
        </div>
        <div className="flex gap-3.5">
          {(g.guess !== null || g.result) && (
            <GameLinkButton onClick={onGuessAgain} className="py-0.5">
              Guess again
            </GameLinkButton>
          )}
          {removable && (
            <GameLinkButton
              data-remove
              warn={armed}
              onClick={onRemove}
              className="py-0.5"
            >
              {armed ? "Click again to remove" : "Remove"}
            </GameLinkButton>
          )}
        </div>
      </div>
    </GuestColumn>
  );
}

/** One of the three statements, coloured by what the class and the player have
 *  said about it. */
function Statement({
  guest: g,
  index: k,
  pickable,
  onClick,
  onEdit,
}: {
  guest: Guest;
  index: number;
  pickable: boolean;
  onClick: () => void;
  onEdit: () => void;
}) {
  const text = g.statements[k].trim();
  const isGuess = k === g.guess;

  let look: "empty" | "plain" | "picked" | "lie" | "truth" = text
    ? "plain"
    : "empty";
  let chip: { label: string; className: string } | null = null;
  let dim = false;
  let locked = false;
  let said = "";

  if (text && g.result === "right") {
    locked = true;
    if (isGuess) {
      look = "lie";
      chip = { label: "Lie", className: cn(DANGER_FILL, "-rotate-4") };
      said = ", the lie";
    } else {
      look = "truth";
      dim = true;
    }
  } else if (text && g.result === "wrong") {
    if (isGuess) {
      look = "truth";
      locked = true;
      chip = { label: "True", className: JADE_FILL };
      said = ", true";
    } else if (k === g.lie) {
      look = "lie";
      chip = { label: "Lie", className: cn(DANGER_FILL, "-rotate-4") };
      said = ", the lie";
    } else if (g.lie !== null) {
      look = "truth";
      dim = true;
    }
  } else if (text && isGuess) {
    look = "picked";
    chip = { label: "Lie?", className: JADE_FILL };
    said = ", the class's guess";
  }

  return (
    <div className="group/st relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Statement ${k + 1}: ${text || "empty"}${said}`}
        className={cn(
          "flex min-h-16 w-full items-start gap-[9px] rounded-xl border py-2.5 pr-[34px] pl-2.5 text-left transition-[border-color,box-shadow,background-color,transform] duration-150",
          locked ? "cursor-default" : "cursor-pointer",
          look === "empty" && "border-dashed bg-transparent",
          look === "plain" && "bg-card",
          look === "picked" &&
            "border-ring bg-accent shadow-[inset_0_0_0_2px_var(--ring)]",
          look === "lie" &&
            "border-[#9B2C2C] bg-[#F6DEDA] shadow-[inset_0_0_0_2px_#9B2C2C] dark:border-[#E26D5F] dark:bg-[#3A1F1C] dark:shadow-[inset_0_0_0_2px_#E26D5F]",
          look === "truth" && "border-ring bg-card",
          dim && "opacity-70",
          pickable &&
            text &&
            !locked &&
            "hover:-translate-y-px hover:border-ring hover:shadow-[inset_0_0_0_1px_var(--ring)]",
        )}
      >
        <span
          className={cn(
            "mt-px grid size-[22px] flex-none place-items-center rounded-full text-[11px] font-bold",
            look === "lie"
              ? DANGER_FILL
              : look === "picked" || look === "truth"
                ? JADE_FILL
                : "bg-muted text-muted-foreground",
          )}
        >
          {k + 1}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-sm leading-[1.35] wrap-anywhere",
            text ? "font-semibold" : "font-medium text-muted-foreground",
          )}
        >
          {text || `Write statement ${k + 1}`}
        </span>
      </button>

      {chip && (
        <span
          className={cn(
            "pointer-events-none absolute right-2 -bottom-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.1em] uppercase",
            chip.className,
          )}
        >
          {chip.label}
        </span>
      )}

      {text && (
        <button
          type="button"
          aria-label={`Edit statement ${k + 1}`}
          onClick={onEdit}
          className="absolute top-1.5 right-1.5 grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground opacity-0 group-hover/st:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <PencilIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Typing a statement. Enter or leaving the field saves (and moves on to the next
 * blank one); Escape keeps what was there.
 */
function StatementInput({
  index: k,
  value,
  onCommit,
}: {
  index: number;
  value: string;
  onCommit: (value: string | null) => void;
}) {
  // Enter commits and unmounts the field, and some browsers then fire a blur on
  // the way out. The guard makes the second one a no-op.
  const done = useRef(false);
  function finish(v: string | null) {
    if (done.current) return;
    done.current = true;
    onCommit(v);
  }

  return (
    <textarea
      autoFocus
      rows={2}
      maxLength={90}
      defaultValue={value}
      placeholder={`Statement ${k + 1}, press Enter`}
      aria-label={`Statement ${k + 1}`}
      onFocus={(e) => {
        const end = e.currentTarget.value.length;
        e.currentTarget.setSelectionRange(end, end);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(e.currentTarget.value);
        }
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.target.value)}
      className="block min-h-16 w-full resize-none rounded-xl border-2 border-ring bg-card px-2.5 py-[9px] text-sm leading-[1.35] font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground"
    />
  );
}
