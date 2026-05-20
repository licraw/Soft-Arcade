import type { ComponentType } from "react";
import { BeatTheScramblerGame } from "./beat-the-scrambler";

export type GameDefinition = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  instructions: string[];
  type: "react" | "vanilla";
  component: ComponentType;
};

export const games: GameDefinition[] = [
  {
    id: "beat-the-scrambler",
    slug: "beat-the-scrambler",
    title: "Beat the Scrambler",
    shortDescription: "Slide the numbered tiles back into order before the Scrambler gets the last laugh.",
    description:
      "A fast, neon sliding puzzle with easy, medium, and hard boards, local personal bests, and arcade-style score submission.",
    instructions: [
      "Choose Easy, Medium, or Hard from the start menu.",
      "Use arrow keys on desktop or swipe on mobile to slide a neighboring tile into the empty space.",
      "Restore the board to numeric order, then save your arcade name if you want to submit a score."
    ],
    type: "vanilla",
    component: BeatTheScramblerGame
  }
];

export function getGameBySlug(slug: string) {
  return games.find((game) => game.slug === slug);
}
