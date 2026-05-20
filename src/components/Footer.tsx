import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <p>Soft Arcade</p>
      <nav aria-label="Footer navigation">
        <Link href="/about">About</Link>
        <Link href="/games">Games</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  );
}
