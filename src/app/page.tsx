import Link from "next/link";
import { ArcadeGameCard } from "@/components/ArcadeGameCard";
import { DailyScramble } from "@/components/DailyScramble";
import { ScramblerMascot } from "@/components/ScramblerMascot";
import { games } from "@/games/registry";

export default function HomePage() {
  const featuredGame = games[0];

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
          <p className="eyebrow">Arcade Shelf</p>
          <h2>Games</h2>
        </div>
        <div className="arcade-card-list">
          {games.map((game) => (
            <ArcadeGameCard game={game} key={game.id} />
          ))}
        </div>
      </section>

      <section className="content-section daily-scramble-section">
        <DailyScramble />
      </section>
    </main>
  );
}
