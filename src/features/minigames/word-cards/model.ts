import {
  WORD_MODULES,
  deckCards,
  deckId,
  findModule,
  firstDeck,
  type DeckRef,
  type WordCard,
} from "./decks";

// Word Cards: one student explains a word to the others without saying any of
// the five words under it. The teacher sends each card privately (WhatsApp) to
// whoever is explaining, and the card is marked as sent so it isn't dealt twice.

export type WordCardsState = {
  deck: DeckRef;
  /** Words already sent, per deck (see `deckId`) — switching decks and back
   *  keeps each one's marks. */
  sent: Record<string, string[]>;
};

export function freshWordCards(): WordCardsState {
  return { deck: firstDeck(WORD_MODULES[0]), sent: {} };
}

/** A stored round, if it still points at a deck this build has. */
export function parseWordCards(raw: unknown): WordCardsState | null {
  const s = raw as WordCardsState | null;
  if (!s || !s.deck || typeof s.sent !== "object" || !s.sent) return null;
  return deckCards(s.deck).length ? s : null;
}

export function sentIn(state: WordCardsState): Set<string> {
  return new Set(state.sent[deckId(state.deck)] ?? []);
}

/** The same round with one more word marked sent in the current deck. */
export function markSent(state: WordCardsState, word: string): WordCardsState {
  const id = deckId(state.deck);
  const done = state.sent[id] ?? [];
  if (done.includes(word)) return state;
  return { ...state, sent: { ...state.sent, [id]: [...done, word] } };
}

/** Every card in the current deck back in play. */
export function resetSent(state: WordCardsState): WordCardsState {
  const rest = { ...state.sent };
  delete rest[deckId(state.deck)];
  return { ...state, sent: rest };
}

/** Switches to a module (its first unit, if it has units) or to a unit. */
export function selectDeck(
  state: WordCardsState,
  moduleId: string,
  unitId?: string,
): WordCardsState {
  const module = findModule(moduleId);
  if (!module) return state;
  const deck =
    unitId && module.units ? { module: moduleId, unit: unitId } : firstDeck(module);
  return { ...state, deck };
}

/** The message pasted into WhatsApp. WhatsApp turns `*…*` bold and `_…_`
 *  italic by itself. */
export function cardMessage(card: WordCard): string {
  return `Your word: *${card.word.toUpperCase()}*\nDon't say: _${card.taboo.join(", ")}_`;
}

/** Any one of `cards`, for "Copy a random one". */
export function pickRandom(cards: WordCard[]): WordCard | undefined {
  return cards[Math.floor(Math.random() * cards.length)];
}

/** Categories in the deck's own order. */
export function categoriesOf(cards: WordCard[]): string[] {
  return [...new Set(cards.map((c) => c.category))];
}
