import type { ReactNode } from "react";
import type { GameDefinition } from "@/games/registry";
import { AdSlot } from "./AdSlot";
import { DailyScramble } from "./DailyScramble";
import { Leaderboard } from "./Leaderboard";

type GamePageShellProps = {
  game: GameDefinition;
  children: ReactNode;
};

export function GamePageShell({ game, children }: GamePageShellProps) {
  return (
    <main className="game-page">
      <section className="game-heading">
        <p className="eyebrow">Soft Arcade Game</p>
        <h1>{game.title}</h1>
        <p>{game.description}</p>
      </section>

      <section className="game-layout" aria-label={`${game.title} play area`}>
        <div className="game-stage">{children}</div>
        <aside className="game-rail" aria-label="Game side panel">
          <Leaderboard />
          <DailyScramble compact />
          <AdSlot />
        </aside>
      </section>

      <section className="how-to-play" aria-labelledby="how-to-play-title">
        <h2 id="how-to-play-title">How to Play</h2>
        <ul>
          {game.instructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
