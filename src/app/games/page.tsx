import Link from "next/link";
import { games } from "@/games/registry";

export const metadata = {
  title: "Games"
};

export default function GamesPage() {
  return (
    <main className="content-section">
      <div className="section-heading">
        <p className="eyebrow">Soft Arcade Library</p>
        <h1>Games</h1>
        <p>Pick a game and jump in. More titles can be added through the game registry.</p>
      </div>
      <div className="game-card-grid">
        {games.map((game) => (
          <Link className="game-card" href={`/games/${game.slug}`} key={game.id}>
            <span>{game.title}</span>
            <p>{game.shortDescription}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
