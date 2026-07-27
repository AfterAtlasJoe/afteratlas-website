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
    <article className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold">{article.title}</h1>
      <p className="text-xs text-zinc-500">
        {article.publishedAt.toLocaleDateString()}
      </p>
      <div className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
        {article.body}
      </div>
    </article>
  );
}
