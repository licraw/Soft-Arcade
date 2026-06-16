import type { Metadata } from "next";
import { LabArticleCard } from "@/components/LabArticleCard";
import { getAllLabArticles } from "@/lib/labs/articles";

export const metadata: Metadata = {
  title: "Soft Arcade Labs",
  description: "Technical notes, devlogs, and browser game engineering writeups from Soft Arcade.",
  alternates: {
    canonical: "/labs"
  },
  openGraph: {
    title: "Soft Arcade Labs",
    description: "Technical notes, devlogs, and browser game engineering writeups from Soft Arcade.",
    url: "/labs",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Soft Arcade Labs",
    description: "Technical notes, devlogs, and browser game engineering writeups from Soft Arcade."
  }
};

export default function LabsPage() {
  const articles = getAllLabArticles();

  return (
    <main className="content-section labs-page">
      <section className="labs-hero" aria-labelledby="labs-title">
        <div className="section-heading labs-heading">
          <div className="hero-kicker">
            <span className="hero-status-light" aria-hidden="true"></span>
            <p className="eyebrow">Soft Arcade Notes</p>
          </div>
          <h1 id="labs-title">Soft Arcade Labs</h1>
          <p>Technical notes, devlogs, and browser game engineering writeups from the Soft Arcade workbench.</p>
        </div>
      </section>

      <section className="labs-list-section" aria-labelledby="labs-articles-title">
        <div className="section-heading labs-list-heading">
          <p className="eyebrow">Published Notes</p>
          <h2 id="labs-articles-title">Articles</h2>
        </div>
        {articles.length ? (
          <div className="lab-card-grid">
            {articles.map((article) => (
              <LabArticleCard article={article} key={article.slug} />
            ))}
          </div>
        ) : (
          <div className="empty-arcade-card">
            <p>Labs articles will appear here once markdown files are published.</p>
          </div>
        )}
      </section>
    </main>
  );
}

