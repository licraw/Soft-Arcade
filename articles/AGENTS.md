# Soft Arcade Labs Article Workflow

Markdown is the source of truth for Soft Arcade Labs. Do not hardcode article bodies into TSX files.

## Spec Phase

A research agent reads the codebase and creates a spec in `articles/specs/article-name.md`.

Specs should include:

- Summary of the article idea
- Relevant modules and runtime behavior
- Code references with file paths and symbols
- Diagrams or diagram notes when useful
- Writing guidance, angle, and intended audience

Specs are working documents. They are not public article pages and should not include publish-only assumptions unless clearly labeled.

## Writing Phase

A writing agent reads one spec and creates or updates `articles/article-name.md`.

The article file should be publish-ready prose and must include the required frontmatter. The writing agent should not overwrite, delete, or rewrite the source spec unless explicitly asked.

Required frontmatter:

```yaml
---
title: "Article title"
description: "A short summary for cards and SEO."
slug: "article-slug"
publishedAt: "2026-06-16"
updatedAt: "2026-06-16"
category: "Engineering"
tags:
  - Browser Games
  - JavaScript
heroImage: "/labs/article-slug/hero.png"
canonicalPath: "/labs/article-slug"
---
```

`heroImage` and `canonicalPath` are optional. Use `heroImage` only when the file exists or when a placeholder has intentionally been added.

## Publishing Phase

The site reads `articles/*.md` and ignores `articles/specs`.

Publishing behavior:

- `/labs` renders article cards from markdown frontmatter.
- `/labs/[slug]` renders article content from markdown.
- SEO metadata is generated from article frontmatter.
- Article bodies stay in markdown files.

## Screenshot And Media Phase

Screenshots and article images should be saved under `public/labs/<slug>/`.

Conventions:

- Hero image: `public/labs/<slug>/hero.png`
- Inline images: `/labs/<slug>/<file>`
- Do not use random external images.
- If screenshots are not available, add clear markdown placeholders such as `[IMAGE: Original puzzle board]` or `[DIAGRAM: Solvable scramble algorithm]`.
- Replace placeholders with local images when screenshots are captured.

Inline images should use normal markdown:

```md
![Descriptive alt text](/labs/article-slug/screenshot.png)
```

