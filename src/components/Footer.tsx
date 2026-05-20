import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <p>Soft Arcade</p>
      <nav aria-label="Footer navigation">
        <Link href="/privacy">Privacy</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  );
}
