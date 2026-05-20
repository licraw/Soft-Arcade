import Link from "next/link";

export default function NotFound() {
  return (
    <main className="text-page">
      <h1>Game Not Found</h1>
      <p>That game is not in the Soft Arcade registry.</p>
      <Link href="/games" className="primary-link">Browse Games</Link>
    </main>
  );
}
