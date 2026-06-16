import Image from "next/image";
import type { ReactNode } from "react";

type MarkdownArticleProps = {
  content: string;
};

type TableBlock = {
  headers: string[];
  rows: string[][];
};

function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseInline(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith("`")) {
      nodes.push(<code key={`${token}-${match.index}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("![")) {
      const imageMatch = token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

      if (imageMatch) {
        nodes.push(
          <span className="markdown-inline-image" key={`${token}-${match.index}`}>
            <Image src={imageMatch[2]} alt={imageMatch[1]} width={960} height={540} sizes="(max-width: 900px) 100vw, 860px" />
          </span>
        );
      }
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

      if (linkMatch) {
        nodes.push(
          <a href={linkMatch[2]} key={`${token}-${match.index}`}>
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }

  return nodes;
}

function parseTable(lines: string[], startIndex: number): { table: TableBlock; nextIndex: number } | null {
  const headerLine = lines[startIndex];
  const separatorLine = lines[startIndex + 1];

  if (!headerLine?.includes("|") || !separatorLine?.match(/^\s*\|?[\s:-]+\|[\s|:-]+\s*$/)) {
    return null;
  }

  const splitRow = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const headers = splitRow(headerLine);
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (lines[index]?.includes("|")) {
    rows.push(splitRow(lines[index]));
    index += 1;
  }

  return {
    table: { headers, rows },
    nextIndex: index
  };
}

function renderTable(table: TableBlock, key: number) {
  return (
    <div className="markdown-table-wrap" key={key}>
      <table>
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{parseInline(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row.join("-")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{parseInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlocks(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        <pre key={index}>
          <code data-language={language || undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      index += 1;
      continue;
    }

    const table = parseTable(lines, index);

    if (table) {
      blocks.push(renderTable(table.table, index));
      index = table.nextIndex;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);

    if (headingMatch) {
      const level = Math.max(2, headingMatch[1].length);
      const text = headingMatch[2];
      const id = slugifyHeading(text);
      const HeadingTag = `h${level}` as "h2" | "h3" | "h4";

      blocks.push(
        <HeadingTag id={id} key={index}>
          {parseInline(text)}
        </HeadingTag>
      );
      index += 1;
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      const items: string[] = [];

      while (lines[index]?.match(/^\s*[-*]\s+/)) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={index}>
          {items.map((item) => (
            <li key={item}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = [];

      while (lines[index]?.match(/^\s*\d+\.\s+/)) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={index}>
          {items.map((item) => (
            <li key={item}>{parseInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];

      while (lines[index]?.startsWith(">")) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(<blockquote key={index}>{quoteLines.map((quoteLine) => <p key={quoteLine}>{parseInline(quoteLine)}</p>)}</blockquote>);
      continue;
    }

    const placeholderMatch = line.match(/^\[(IMAGE|DIAGRAM):\s*(.+)\]$/);

    if (placeholderMatch) {
      blocks.push(
        <aside className="article-media-placeholder" key={index}>
          <span>{placeholderMatch[1]}</span>
          <p>{placeholderMatch[2]}</p>
        </aside>
      );
      index += 1;
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !lines[index].startsWith("```") &&
      !lines[index].match(/^(#{1,4})\s+/) &&
      !lines[index].match(/^\s*[-*]\s+/) &&
      !lines[index].match(/^\s*\d+\.\s+/) &&
      !lines[index].startsWith(">") &&
      !lines[index].match(/^\[(IMAGE|DIAGRAM):\s*(.+)\]$/)
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(<p key={index}>{parseInline(paragraphLines.join(" "))}</p>);
  }

  return blocks;
}

export function MarkdownArticle({ content }: MarkdownArticleProps) {
  return <div className="markdown-article">{renderBlocks(content)}</div>;
}
