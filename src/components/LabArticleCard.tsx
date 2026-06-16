import Link from "next/link";
import type { LabArticle } from "@/lib/labs/articles";

type LabArticleCardProps = {
  article: LabArticle;
};

export function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function LabArticleCard({ article }: LabArticleCardProps) {
  return (
    <Link href={`/labs/${article.slug}`} className="lab-card">
      <div className="lab-card-meta">
        <span>{article.category}</span>
        <span>{formatArticleDate(article.publishedAt)}</span>
        <span>{article.readingTime} min read</span>
      </div>
      <h2>{article.title}</h2>
      <p>{article.description}</p>
      <div className="lab-tag-list" aria-label={`${article.title} tags`}>
        {article.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </Link>
  );
}

