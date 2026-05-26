import type { ComponentType } from "react";
import { BeatTheScramblerGame } from "./beat-the-scrambler";
import { NearMissGame } from "./near-miss";

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
  },
  {
    id: "near-miss",
    slug: "near-miss",
    title: "Near Miss",
    shortDescription: "Thread soft-neon traffic lanes, skim close calls, and keep a clean run alive as speed climbs.",
    description:
      "A fast canvas arcade driver about lane switching, survival, close-call bonuses, and streak-driven score chasing.",
    instructions: [
      "Hold ArrowLeft and ArrowRight, or A and D, to steer smoothly across the road.",
      "Use ArrowUp or W to push speed, and ArrowDown or S to brake through tight gaps.",
      "On touch screens, hold the on-screen left, right, gas, and brake buttons.",
      "Avoid traffic, skim close calls for bonus points, and chain near misses to build a streak."
    ],
    type: "react",
    component: NearMissGame
  }
];

export function getGameBySlug(slug: string) {
  return games.find((game) => game.slug === slug);
}
