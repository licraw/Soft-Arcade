import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArticleDate, LabArticleCard } from "@/components/LabArticleCard";
import { MarkdownArticle } from "@/components/MarkdownArticle";
import { getAllLabArticles, getLabArticleBySlug, getRelatedLabArticles } from "@/lib/labs/articles";

type LabArticleRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllLabArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: LabArticleRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getLabArticleBySlug(slug);

  if (!article) {
    return { title: "Article Not Found" };
  }

  const canonicalPath = article.canonicalPath ?? `/labs/${article.slug}`;
  const images = article.heroImage ? [{ url: article.heroImage, alt: article.title }] : undefined;

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: canonicalPath,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      tags: article.tags,
      images
    },
    twitter: {
      card: article.heroImage ? "summary_large_image" : "summary",
      title: article.title,
      description: article.description,
      images: article.heroImage ? [article.heroImage] : undefined
    }
  };
}

export default async function LabArticlePage({ params }: LabArticleRouteProps) {
  const { slug } = await params;
  const article = getLabArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedLabArticles(article.slug);

  return (
    <main className="content-section lab-article-page">
      <div className="back-link-wrapper">
        <Link href="/labs" className="back-link">Back to Labs</Link>
      </div>
      <article>
        <header className="lab-article-header">
          <p className="eyebrow">{article.category}</p>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <div className="lab-article-meta">
            <span>{formatArticleDate(article.publishedAt)}</span>
            <span>{article.readingTime} min read</span>
            {article.updatedAt !== article.publishedAt ? <span>Updated {formatArticleDate(article.updatedAt)}</span> : null}
          </div>
          <div className="lab-tag-list" aria-label={`${article.title} tags`}>
            {article.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </header>

        {article.heroImage ? (
          <div className="lab-hero-image">
            <Image src={article.heroImage} alt="" width={1200} height={675} priority sizes="(max-width: 900px) 100vw, 960px" />
          </div>
        ) : null}

        <MarkdownArticle content={article.content} />
      </article>

      {relatedArticles.length ? (
        <section className="related-labs" aria-labelledby="related-labs-title">
          <div className="section-heading">
            <p className="eyebrow">Keep Reading</p>
            <h2 id="related-labs-title">Related Labs</h2>
          </div>
          <div className="lab-card-grid">
            {relatedArticles.map((relatedArticle) => (
              <LabArticleCard article={relatedArticle} key={relatedArticle.slug} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

