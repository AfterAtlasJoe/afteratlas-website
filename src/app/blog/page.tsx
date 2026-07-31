import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guidance and stories on navigating what comes after loss.",
};

export default async function BlogIndexPage() {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative w-full overflow-hidden bg-blush">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full bg-blush-deep/70 blur-2xl"
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-20">
          <h1 className="font-display text-5xl font-bold tracking-tight text-black">Blog</h1>
          <p className="mt-4 text-lg text-zinc-700">
            Guidance and stories on navigating what comes after loss.
          </p>
        </div>
      </div>

      {/*
        Explicit bg-white, same reasoning as the About page — the reference
        site has no dark mode, and without a fixed background here this
        section would inherit the app's dark-mode page background while
        keeping hardcoded black/zinc text.
      */}
      <div className="w-full bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          {articles.length === 0 ? (
            <p className="text-sm text-zinc-500">No articles published yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/blog/${article.slug}`}
                    className="block rounded-lg border border-black/10 p-5 transition-colors hover:bg-blush/40"
                  >
                    <p className="font-display text-xl font-semibold text-accent-ink">
                      {article.title}
                    </p>
                    {article.publishedAt ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Last published {article.publishedAt.toLocaleDateString()}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
