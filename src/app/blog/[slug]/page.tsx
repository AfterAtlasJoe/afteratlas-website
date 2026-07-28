import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

  return (
    <div className="flex flex-1 flex-col">
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
            {article.publishedAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Same fixed bg-white reasoning as the About/Blog-index pages. */}
      <div className="w-full bg-white">
        <article className="mx-auto w-full max-w-2xl px-6 py-16">
          <div className="whitespace-pre-wrap text-lg text-zinc-700">{article.body}</div>
        </article>
      </div>
    </div>
  );
}
