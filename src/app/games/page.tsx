import Link from "next/link";
import { ScramblerMascot } from "@/components/ScramblerMascot";
import { games } from "@/games/registry";

export const metadata = {
  title: "Games"
};

export default function GamesPage() {
  const flagshipGame = games[0];
  const otherGames = games.slice(1);

  return (
    <main className="content-section games-library">
      <section className="games-hero" aria-labelledby="games-title">
        <div className="section-heading games-heading">
          <div className="hero-kicker">
            <span className="hero-status-light" aria-hidden="true"></span>
            <p className="eyebrow">Soft Arcade Library</p>
          </div>
          <h1 id="games-title">Games</h1>
          <p>Fast browser games built for quick rounds, clean controls, and arcade-score chasing.</p>
        </div>
        <div className="games-hero-badge" aria-hidden="true">
          <ScramblerMascot title="The Scrambler mascot" />
          <span>Now Playing</span>
        </div>
      </section>

      <section className="games-featured" aria-labelledby="flagship-title">
        <Link className="featured-game-card games-featured-card" href={`/games/${flagshipGame.slug}`}>
          <div className="featured-game-art" aria-hidden="true">
            <ScramblerMascot title="The Scrambler mascot" />
            <div className="featured-tile-stack">
              <span>7</span>
              <span>2</span>
              <span>14</span>
            </div>
          </div>
          <div className="featured-game-copy">
            <div className="featured-game-heading">
              <p className="eyebrow">Flagship Game</p>
              <h2 id="flagship-title">{flagshipGame.title}</h2>
            </div>
            <p>{flagshipGame.description}</p>
            <div className="difficulty-tags" aria-label="Available difficulties">
              <span>Easy 3x3</span>
              <span>Medium 4x4</span>
              <span>Hard 5x5</span>
            </div>
          </div>
          <span className="featured-game-cta">Play now</span>
        </Link>
      </section>

      <section className="games-list-section" aria-labelledby="all-games-title">
        <div className="section-heading games-list-heading">
          <p className="eyebrow">Arcade Shelf</p>
          <h2 id="all-games-title">All Games</h2>
        </div>
        {otherGames.length ? (
          <div className="game-card-grid">
            {otherGames.map((game) => (
              <Link className="game-card" href={`/games/${game.slug}`} key={game.id}>
                <span>{game.title}</span>
                <p>{game.shortDescription}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-arcade-card">
            <p>More cabinets are warming up.</p>
          </div>
        )}
      </section>
    </main>
  );
}
