import fs from "node:fs";
import path from "node:path";

const articlesDirectory = path.join(process.cwd(), "articles");

export type LabArticleFrontmatter = {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  tags: string[];
  heroImage?: string;
  canonicalPath?: string;
};

export type LabArticle = LabArticleFrontmatter & {
  content: string;
  readingTime: number;
  sourcePath: string;
};

type ParsedMarkdown = {
  frontmatter: Record<string, string | string[]>;
  content: string;
};

function parseFrontmatter(fileContent: string): ParsedMarkdown {
  if (!fileContent.startsWith("---")) {
    throw new Error("Lab article is missing required frontmatter.");
  }

  const closingMarker = fileContent.indexOf("\n---", 3);

  if (closingMarker === -1) {
    throw new Error("Lab article frontmatter is missing a closing marker.");
  }

  const frontmatterBlock = fileContent.slice(3, closingMarker).trim();
  const content = fileContent.slice(closingMarker + 4).trim();
  const frontmatter: Record<string, string | string[]> = {};
  const lines = frontmatterBlock.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const keyValueMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

    if (!keyValueMatch) {
      continue;
    }

    const [, key, rawValue] = keyValueMatch;

    if (rawValue === "") {
      const values: string[] = [];

      while (lines[index + 1]?.match(/^\s*-\s+/)) {
        index += 1;
        values.push(stripYamlQuotes(lines[index].replace(/^\s*-\s+/, "").trim()));
      }

      frontmatter[key] = values;
    } else if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      frontmatter[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((value) => stripYamlQuotes(value.trim()))
        .filter(Boolean);
    } else {
      frontmatter[key] = stripYamlQuotes(rawValue.trim());
    }
  }

  return { frontmatter, content };
}

function stripYamlQuotes(value: string) {
  return value.replace(/^["']|["']$/g, "");
}

function requireString(frontmatter: Record<string, string | string[]>, key: keyof LabArticleFrontmatter) {
  const value = frontmatter[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Lab article is missing required frontmatter field: ${key}`);
  }

  return value;
}

function normalizeFrontmatter(frontmatter: Record<string, string | string[]>): LabArticleFrontmatter {
  const tags = frontmatter.tags;

  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error("Lab article is missing required frontmatter field: tags");
  }

  return {
    title: requireString(frontmatter, "title"),
    description: requireString(frontmatter, "description"),
    slug: requireString(frontmatter, "slug"),
    publishedAt: requireString(frontmatter, "publishedAt"),
    updatedAt: requireString(frontmatter, "updatedAt"),
    category: requireString(frontmatter, "category"),
    tags,
    heroImage: typeof frontmatter.heroImage === "string" ? frontmatter.heroImage : undefined,
    canonicalPath: typeof frontmatter.canonicalPath === "string" ? frontmatter.canonicalPath : undefined
  };
}

function getArticleFileNames() {
  if (!fs.existsSync(articlesDirectory)) {
    return [];
  }

  return fs
    .readdirSync(articlesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "AGENTS.md")
    .map((entry) => entry.name);
}

function readArticle(fileName: string): LabArticle {
  const sourcePath = path.join(articlesDirectory, fileName);
  const fileContent = fs.readFileSync(sourcePath, "utf8");
  const parsed = parseFrontmatter(fileContent);
  const frontmatter = normalizeFrontmatter(parsed.frontmatter);

  return {
    ...frontmatter,
    content: parsed.content,
    readingTime: calculateReadingTime(parsed.content),
    sourcePath
  };
}

export function calculateReadingTime(content: string) {
  const words = content
    .replace(/```[\s\S]*?```/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return Math.max(1, Math.ceil(words.length / 220));
}

export function getAllLabArticles() {
  return getArticleFileNames()
    .map(readArticle)
    .sort((first, second) => Date.parse(second.publishedAt) - Date.parse(first.publishedAt));
}

export function getLabArticleBySlug(slug: string) {
  return getAllLabArticles().find((article) => article.slug === slug) ?? null;
}

export function getRelatedLabArticles(slug: string, limit = 3) {
  const article = getLabArticleBySlug(slug);

  if (!article) {
    return [];
  }

  return getAllLabArticles()
    .filter((candidate) => candidate.slug !== slug)
    .map((candidate) => ({
      article: candidate,
      score:
        (candidate.category === article.category ? 2 : 0) +
        candidate.tags.filter((tag) => article.tags.includes(tag)).length
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((candidate) => candidate.article);
}
