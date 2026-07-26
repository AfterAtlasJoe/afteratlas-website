import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Blog</h1>
      {articles.length === 0 ? (
        <p className="text-sm text-zinc-500">No articles published yet.</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link href={`/blog/${article.slug}`} className="text-lg font-medium underline">
                {article.title}
              </Link>
              {article.publishedAt ? (
                <p className="text-xs text-zinc-500">
                  {article.publishedAt.toLocaleDateString()}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
