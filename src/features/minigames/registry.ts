import {
  DramaIcon,
  Grid3x3Icon,
  MessageSquareOffIcon,
  VenetianMaskIcon,
  type LucideIcon,
} from "lucide-react";
import type { MinigameId } from "@/lib/lessons";
import type { GameProps } from "./game-ui";
import { Crossings } from "./crossings";
import { TwoTruths } from "./two-truths";
import { WordCards } from "./word-cards";
import { WhoAmI } from "./who-am-i";

// The classroom games, by id. The same id is what a `minigame` slide block
// stores, and what /minigames/$gameId is addressed by — add a game here and both
// pick it up.

export type MinigameDefinition = {
  id: MinigameId;
  title: string;
  /** One line on the gallery card and in the studio. */
  description: string;
  icon: LucideIcon;
  Game: React.FC<GameProps>;
};

export const MINIGAMES: Record<MinigameId, MinigameDefinition> = {
  "who-am-i": {
    id: "who-am-i",
    title: "Who Am I?",
    description:
      "A secret character on each forehead. Yes/no questions until someone guesses.",
    icon: VenetianMaskIcon,
    Game: WhoAmI,
  },
  "two-truths": {
    id: "two-truths",
    title: "Two Truths, One Lie",
    description:
      "Three things about yourself, one of them false. The class points at the lie.",
    icon: DramaIcon,
    Game: TwoTruths,
  },
  "word-cards": {
    id: "word-cards",
    title: "Word Cards",
    description:
      "Explain the word without saying the five under it. Cards go out by WhatsApp.",
    icon: MessageSquareOffIcon,
    Game: WordCards,
  },
  crossings: {
    id: "crossings",
    title: "Book One Crossings",
    description:
      "One secret square each, one clue that links its two words. Book One vocabulary.",
    icon: Grid3x3Icon,
    Game: Crossings,
  },
};

/** Gallery order. */
export const MINIGAME_ORDER: MinigameId[] = [
  "who-am-i",
  "two-truths",
  "word-cards",
  "crossings",
];

export function isMinigameId(id: string): id is MinigameId {
  return id in MINIGAMES;
}
