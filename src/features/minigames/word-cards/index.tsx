import { useState } from "react";
import { cn } from "@/lib/utils";
import { copyText } from "../clipboard";
import { useGameToast } from "../game-toast";
import {
  GAME_DANGER_TEXT,
  GAME_INPUT,
  GameButton,
  GameDialog,
  GameDialogTitle,
  GameField,
  GameSelect,
  type GameProps,
  GameHeader,
  GamePaper,
} from "../game-ui";
import { useArmed } from "../use-armed";
import { useGameState } from "../use-game-state";
import { WORD_MODULES, deckCards, findModule, type WordCard } from "./decks";
import {
  cardMessage,
  categoriesOf,
  freshWordCards,
  markSent,
  parseWordCards,
  pickRandom,
  resetSent,
  selectDeck,
  sentIn,
} from "./model";

// Layout: the header with the deck (module, unit) and the deck's actions; a
// sticky bar with the count, "hide sent" and the category chips; then the cards,
// grouped by category. A card is the word over its five forbidden words; pressing
// it copies the WhatsApp message for whoever is explaining, and marks it sent.

/** Clicking anywhere but the armed Reset stands it down — see useArmed. */
const RESET = "reset";

export function WordCards({ scope, lead }: GameProps) {
  const { state, commit, undo, canUndo } = useGameState(
    "word-cards",
    scope,
    parseWordCards,
    freshWordCards,
  );
  const { show, toast } = useGameToast(1800);
  const [armed, setArmed] = useArmed();
  // What this device is looking at — not part of the round, so the projector
  // and the iPad can each filter their own way.
  const [category, setCategory] = useState("all");
  const [hideSent, setHideSent] = useState(false);
  /** The card last copied, outlined until the next one. */
  const [flash, setFlash] = useState<string | null>(null);
  /** The message a refused copy couldn't deliver, shown to copy by hand. */
  const [manual, setManual] = useState<string | null>(null);

  const module = findModule(state.deck.module) ?? WORD_MODULES[0];
  const cards = deckCards(state.deck);
  const sent = sentIn(state);
  const categories = categoriesOf(cards);
  // A category from the previous deck shows everything rather than nothing.
  const active = categories.includes(category) ? category : "all";
  const shown = categories.filter((c) => active === "all" || c === active);

  function send(card: WordCard) {
    const text = cardMessage(card);
    commit(markSent(state, card.word));
    setFlash(card.word);
    void copyText(text).then((ok) => {
      if (ok) show(`Copied: ${card.word.toUpperCase()}. Paste it in WhatsApp.`);
      else setManual(text);
    });
  }

  function sendRandom() {
    const pool = cards.filter(
      (c) => (active === "all" || c.category === active) && !sent.has(c.word),
    );
    const card = pickRandom(pool);
    if (!card) return show("No cards left in this category.");
    send(card);
  }

  return (
    <GamePaper>
      <div className="flex min-h-full flex-col gap-[18px] px-[22px] pt-[18px] pb-7">
        <GameHeader
          lead={lead}
          title="Word Cards"
          subtitle="Explain the word without saying any of the five under it."
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <GameField label="Module">
              <GameSelect
                aria-label="Module"
                value={module.id}
                onChange={(e) => {
                  commit(selectDeck(state, e.target.value));
                  setFlash(null);
                }}
              >
                {WORD_MODULES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </GameSelect>
            </GameField>
            {/* Only a module with units has a second level to pick. */}
            {module.units && (
              <GameField label="Unit">
                <GameSelect
                  aria-label="Unit"
                  value={state.deck.unit ?? ""}
                  onChange={(e) => {
                    commit(selectDeck(state, module.id, e.target.value));
                    setFlash(null);
                  }}
                >
                  {module.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </GameSelect>
              </GameField>
            )}
            <div className="flex flex-wrap gap-2">
              <GameButton
                disabled={!canUndo}
                onClick={() => {
                  if (!undo()) return;
                  setFlash(null);
                  show("Undone.");
                }}
              >
                Undo
              </GameButton>
              <GameButton
                data-remove
                disabled={sent.size === 0}
                className={cn(armed === RESET && GAME_DANGER_TEXT)}
                onClick={() => {
                  if (armed !== RESET) return setArmed(RESET);
                  commit(resetSent(state));
                  setArmed(null);
                  setFlash(null);
                  show("Every card is back in the deck.");
                }}
              >
                {armed === RESET ? "Click again to reset" : "Reset sent"}
              </GameButton>
              <GameButton primary onClick={sendRandom}>
                Copy a random one
              </GameButton>
            </div>
          </div>
        </GameHeader>

        <div className="sticky top-0 z-10 -mx-[22px] flex flex-col gap-2.5 border-b bg-background/95 px-[22px] py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mr-auto text-[13px] text-muted-foreground tabular-nums">
              <b className="font-bold text-foreground">{sent.size}</b> of{" "}
              {cards.length} sent
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={hideSent}
                onChange={(e) => setHideSent(e.target.checked)}
                className="accent-ring"
              />
              Hide sent
            </label>
          </div>
          <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
            {["all", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={active === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "cursor-pointer rounded-full border px-[11px] py-2 text-[12.5px] leading-none font-medium",
                  active === c
                    ? "border-ring bg-accent text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {c === "all" ? "All" : c}
                <span className="ml-1 text-[11px] tabular-nums opacity-70">
                  {c === "all"
                    ? cards.length
                    : cards.filter((x) => x.category === c).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <main className="flex flex-col gap-[22px]">
          {shown.map((c) => {
            const inCategory = cards.filter(
              (x) => x.category === c && !(hideSent && sent.has(x.word)),
            );
            if (!inCategory.length) return null;
            return (
              <section key={c}>
                <h2 className="m-0 mb-2.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {c}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
                  {inCategory.map((card) => (
                    <Card
                      key={card.word}
                      card={card}
                      sent={sent.has(card.word)}
                      flash={flash === card.word}
                      onClick={() => send(card)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {shown.every((c) =>
            cards
              .filter((x) => x.category === c)
              .every((x) => hideSent && sent.has(x.word)),
          ) && (
            <p className="mt-6 text-sm text-muted-foreground">
              Every card in this category has been sent.
            </p>
          )}
        </main>
      </div>

      {toast}

      <GameDialog open={manual !== null} labelledBy="word-cards-manual">
        <GameDialogTitle id="word-cards-manual">Copy it by hand</GameDialogTitle>
        <p className="mb-3 text-sm">
          The browser refused to copy. Select the message and copy it yourself.
        </p>
        <textarea
          readOnly
          value={manual ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          className={cn(GAME_INPUT, "mb-3.5 min-h-[110px] font-mono text-[13.5px] font-medium")}
        />
        <div className="flex justify-end">
          <GameButton primary onClick={() => setManual(null)}>
            Done
          </GameButton>
        </div>
      </GameDialog>
    </GamePaper>
  );
}

/** One card: the word, the "Sent" stamp once it has gone out, and the five
 *  words not to say. */
function Card({
  card,
  sent,
  flash,
  onClick,
}: {
  card: WordCard;
  sent: boolean;
  flash: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Copy ${card.word}${sent ? " (sent)" : ""}`}
      className={cn(
        "flex cursor-pointer flex-col overflow-hidden rounded-[10px] border p-0 text-left transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        sent ? "bg-muted" : "bg-card",
        flash && "border-ring shadow-[0_0_0_3px_var(--accent)]",
      )}
    >
      <span
        className={cn(
          "flex items-baseline justify-between gap-2 border-b border-dashed px-3.5 pt-3.5 pb-2.5 font-display text-[19px] leading-tight uppercase",
          sent && "text-muted-foreground",
        )}
      >
        {card.word}
        <span
          className={cn(
            "font-montserrat text-[10px] font-semibold tracking-[0.08em] text-primary uppercase",
            !sent && "invisible",
          )}
        >
          Sent
        </span>
      </span>
      <ul
        className={cn(
          "m-0 flex list-none flex-col gap-[5px] px-3.5 pt-2.5 pb-3.5",
          sent && "opacity-55",
        )}
      >
        {card.taboo.map((w) => (
          <li
            key={w}
            className={cn(
              "flex items-center gap-2 text-[13.5px] before:h-0.5 before:w-2.5 before:shrink-0 before:bg-current before:opacity-70",
              GAME_DANGER_TEXT,
            )}
          >
            {w}
          </li>
        ))}
      </ul>
    </button>
  );
}
