import Link from "next/link";
import { games } from "@/games/registry";

export default function HomePage() {
  const featuredGame = games[0];

  return (
    <main>
      <section className="home-hero">
        <div>
          <p className="eyebrow">softarcadegames.com</p>
          <h1>Soft Arcade</h1>
          <p>Small browser games with crisp controls, arcade scoring, and no account required.</p>
          <div className="hero-actions">
            <Link href={`/games/${featuredGame.slug}`} className="primary-link">Play {featuredGame.title}</Link>
            <Link href="/games" className="secondary-link">View Games</Link>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p className="eyebrow">Now Playing</p>
          <h2>Featured Game</h2>
        </div>
        <div className="game-card-grid">
          {games.map((game) => (
            <Link className="game-card" href={`/games/${game.slug}`} key={game.id}>
              <span>{game.title}</span>
              <p>{game.shortDescription}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
