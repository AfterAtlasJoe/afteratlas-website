import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { parseFaqFromMarkdown, renderArticleBodyHtml } from "@/lib/blog";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BASE_URL = "https://afteratlas.com";

/** Meta descriptions want a short plain-text snippet, not the whole article body — only used as a fallback for articles without a curated metaDescription. */
function excerpt(body: string, maxLength = 160): string {
  const flattened = body.replace(/\s+/g, " ").trim();
  return flattened.length > maxLength
    ? `${flattened.slice(0, maxLength - 1).trimEnd()}…`
    : flattened;
}

/** Prevents a stray `</script>` inside JSON content from closing the script tag early. */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article || !article.publishedAt) {
    return {};
  }

  const title = article.metaTitle ?? article.title;
  const description = article.metaDescription ?? excerpt(article.body);
  const path = `/blog/${article.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "article",
      publishedTime: article.publishedAt.toISOString(),
      // A page's own `openGraph`/`twitter` object fully replaces the root
      // layout's rather than merging field-by-field, so the site-wide
      // opengraph-image.png convention would otherwise silently disappear
      // on every article page — repeat it explicitly here.
      images: ["/opengraph-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article || !article.publishedAt) {
    notFound();
  }

  const bodyHtml = renderArticleBodyHtml(article.body);
  const faq = parseFaqFromMarkdown(article.body);
  const url = `${BASE_URL}/blog/${article.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.metaDescription ?? excerpt(article.body),
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "After Atlas" },
    publisher: { "@type": "Organization", name: "After Atlas" },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  const faqJsonLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: { "@type": "Answer", text: entry.answer },
          })),
        }
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
        />
      ) : null}

      <div className="relative w-full overflow-hidden bg-blush">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-blush-deep/70 blur-2xl"
        />
        <div className="relative mx-auto w-full max-w-2xl px-6 py-20">
          <Link href="/blog" className="text-sm text-accent-ink underline">
            ← Back to blog
          </Link>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-black">
            {article.title}
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Last published {article.publishedAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Same fixed bg-white reasoning as the About/Blog-index pages. */}
      <div className="w-full bg-white">
        <article
          className="prose-content mx-auto w-full max-w-2xl px-6 py-16 text-lg text-zinc-700
            [&_a]:text-accent-ink [&_a]:underline
            [&_blockquote]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-blush-deep [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-600
            [&_em]:italic
            [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-black
            [&_hr]:my-8 [&_hr]:border-black/10
            [&_li]:mb-1
            [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6
            [&_p]:mb-4
            [&_strong]:font-semibold [&_strong]:text-black
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </div>
  );
}
