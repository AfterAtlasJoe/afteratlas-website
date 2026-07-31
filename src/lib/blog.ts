import { marked } from "marked";

marked.setOptions({ gfm: true });

/**
 * Renders an Article's markdown `body` to HTML. The body is expected to
 * start below the H1 (the page renders `article.title` as its own <h1>
 * separately), so the first heading marked encounters here is an H2 —
 * keeping the page's heading hierarchy to a single H1 with real H2s below it.
 */
export function renderArticleBodyHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

export type FaqEntry = { question: string; answer: string };

/**
 * Extracts Q/A pairs from a "## Frequently asked questions" section written
 * as `**Question?**` immediately followed by its answer paragraph, stopping
 * at the next `##` heading (e.g. "## Sources") or the end of the body.
 * Parsed straight from the same markdown that renders the page, so the
 * FAQPage structured data can never drift out of sync with what's on screen.
 */
export function parseFaqFromMarkdown(markdown: string): FaqEntry[] {
  const headingMatch = markdown.match(/^##\s+Frequently asked questions\s*$/m);
  if (!headingMatch || headingMatch.index === undefined) return [];

  const afterHeading = markdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = afterHeading.match(/\n##\s+/);
  const section = (
    nextHeadingMatch ? afterHeading.slice(0, nextHeadingMatch.index) : afterHeading
  ).trim();

  const entries: FaqEntry[] = [];
  for (const block of section.split(/\n{2,}/)) {
    const match = block.trim().match(/^\*\*(.+?)\*\*\s*\n([\s\S]+)$/);
    if (match) {
      entries.push({ question: match[1].trim(), answer: match[2].trim() });
    }
  }
  return entries;
}
