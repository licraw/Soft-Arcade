import Link from "next/link";
import type { GameDefinition } from "@/games/registry";
import { ScramblerMascot } from "./ScramblerMascot";

type ArcadeGameCardProps = {
  game: GameDefinition;
  headingLevel?: "h2" | "h3";
  cta?: string;
};

const gameCardDetails: Record<string, { eyebrow: string; tags: string[] }> = {
  "beat-the-scrambler": {
    eyebrow: "Flagship Puzzle",
    tags: ["Easy 3x3", "Medium 4x4", "Hard 5x5"]
  },
  "near-miss": {
    eyebrow: "Arcade Driver",
    tags: ["Lane Switching", "Close Calls", "Score Streaks"]
  }
};

export function ArcadeGameCard({ game, headingLevel = "h3", cta = "Start a run" }: ArcadeGameCardProps) {
  const details = gameCardDetails[game.id] ?? { eyebrow: "Arcade Game", tags: ["Quick Rounds"] };
  const Heading = headingLevel;

  return (
    <Link className={`featured-game-card arcade-game-card arcade-game-card-${game.id}`} href={`/games/${game.slug}`}>
      <div className="featured-game-art" aria-hidden="true">
        {game.id === "near-miss" ? <NearMissCardArt /> : <BeatTheScramblerCardArt />}
      </div>
      <div className="featured-game-copy">
        <div className="featured-game-heading">
          <p className="eyebrow">{details.eyebrow}</p>
          <Heading>{game.title}</Heading>
        </div>
        <p>{game.shortDescription}</p>
        <div className="difficulty-tags" aria-label={`${game.title} features`}>
          {details.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <span className="featured-game-cta">{cta}</span>
    </Link>
  );
}

function BeatTheScramblerCardArt() {
  return (
    <>
      <ScramblerMascot />
      <div className="featured-tile-stack">
        <span>8</span>
        <span>3</span>
        <span>15</span>
      </div>
    </>
  );
}

function NearMissCardArt() {
  return (
    <div className="near-miss-card-art">
      <div className="near-miss-card-road">
        <span></span>
        <span></span>
      </div>
      <div className="near-miss-card-car near-miss-card-player"></div>
      <div className="near-miss-card-car near-miss-card-traffic"></div>
    </div>
  );
}
