import Link from "next/link";
import { DailyScramble } from "@/components/DailyScramble";
import { ScramblerMascot } from "@/components/ScramblerMascot";
import { games } from "@/games/registry";

export default function HomePage() {
  const featuredGame = games[0];
  const arcadeShelf = games.slice(1);

  return (
    <main>
      <section className="home-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="hero-status-light" aria-hidden="true"></span>
            <p className="eyebrow">softarcadegames.com</p>
          </div>
          <h1>Soft Arcade</h1>
          <p>Tiny web games, quick rounds, arcade scores, and no account required.</p>
          <div className="hero-actions" aria-label="Homepage actions">
            <Link href={`/games/${featuredGame.slug}`} className="primary-link">Play {featuredGame.title}</Link>
            <Link href="/games" className="secondary-link">View Games</Link>
          </div>
        </div>
        <div className="hero-mascot" aria-hidden="true">
          <div className="mascot-orbit">
            <ScramblerMascot />
          </div>
          <div className="hero-mini-board" aria-hidden="true">
            <span>1</span>
            <span>4</span>
            <span>2</span>
            <span>3</span>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Now Playing</p>
          <h2>Featured Game</h2>
        </div>
        <Link className="featured-game-card" href={`/games/${featuredGame.slug}`}>
          <div className="featured-game-art" aria-hidden="true">
            <ScramblerMascot />
            <div className="featured-tile-stack">
              <span>8</span>
              <span>3</span>
              <span>15</span>
            </div>
          </div>
          <div className="featured-game-copy">
            <div className="featured-game-heading">
              <p className="eyebrow">Flagship Puzzle</p>
              <h3>{featuredGame.title}</h3>
            </div>
            <p>{featuredGame.shortDescription}</p>
            <div className="difficulty-tags" aria-label="Available difficulties">
              <span>Easy 3x3</span>
              <span>Medium 4x4</span>
              <span>Hard 5x5</span>
            </div>
          </div>
          <span className="featured-game-cta">Start a run</span>
        </Link>
      </section>

      <section className="content-section daily-scramble-section">
        <DailyScramble />
      </section>

      {arcadeShelf.length ? (
        <section className="content-section">
          <div className="section-heading">
            <p className="eyebrow">Arcade Shelf</p>
            <h2>More Games</h2>
          </div>
          <div className="game-card-grid">
            {arcadeShelf.map((game) => (
              <Link className="game-card" href={`/games/${game.slug}`} key={game.id}>
                <span>{game.title}</span>
                <p>{game.shortDescription}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
