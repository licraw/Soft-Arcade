import { ArcadeGameCard } from "@/components/ArcadeGameCard";
import { games } from "@/games/registry";

export const metadata = {
  title: "Games"
};

export default function GamesPage() {
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
      </section>

      <section className="games-list-section" aria-labelledby="all-games-title">
        <div className="section-heading games-list-heading">
          <p className="eyebrow">Arcade Shelf</p>
          <h2 id="all-games-title">All Games</h2>
        </div>
        {games.length ? (
          <div className="arcade-card-list">
            {games.map((game) => (
              <ArcadeGameCard game={game} headingLevel="h2" cta="Play now" key={game.id} />
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
