import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GamePageShell } from "@/components/GamePageShell";
import { games, getGameBySlug } from "@/games/registry";

type GameRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return games.map((game) => ({ slug: game.slug }));
}

export async function generateMetadata({ params }: GameRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    return { title: "Game Not Found" };
  }

  return {
    title: game.title,
    description: game.shortDescription
  };
}

export default async function GamePage({ params }: GameRouteProps) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  const GameComponent = game.component;

  return (
    <GamePageShell game={game}>
      <GameComponent />
    </GamePageShell>
  );
}
