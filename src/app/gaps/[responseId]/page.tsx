import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  groupByCategory,
  resolveTriggeredItems,
  type SurveyAnswers,
} from "@/lib/survey-engine";

export const dynamic = "force-dynamic";

export default async function GapsPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/gaps/${responseId}`)}`);
  }

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { eventType: true },
  });
  if (
    !response ||
    response.userId !== session.user.id ||
    response.mode !== "planning"
  ) {
    notFound();
  }

  const gaps = await prisma.gap.findMany({
    where: { eventTypeId: response.eventTypeId },
    include: {
      triggers: { select: { questionId: true, answerOptionId: true } },
      vendorCategory: {
        include: { vendors: { orderBy: { priority: "desc" }, take: 2 } },
      },
    },
  });

  const triggered = resolveTriggeredItems(
    gaps,
    (response.answers as SurveyAnswers) ?? {},
  );
  const grouped = groupByCategory(triggered);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">
          {response.title ?? `Your ${response.eventType.name} planning gaps`}
        </h1>
        <p className="text-sm text-zinc-500">
          {triggered.length} gap{triggered.length === 1 ? "" : "s"} found based
          on your answers.
        </p>
      </div>

      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category} className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{category}</h2>
          {items.map((gap) => (
            <div
              key={gap.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <h3 className="font-medium">{gap.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {gap.description}
              </p>
              {gap.vendorCategory ? (
                <div className="mt-2 rounded-md bg-black/5 p-3 text-sm dark:bg-white/10">
                  <p className="mb-2 font-medium">
                    Need a {gap.vendorCategory.name.toLowerCase()}?
                  </p>
                  {gap.vendorCategory.vendors.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {gap.vendorCategory.vendors.map((vendor) => (
                        <li key={vendor.id}>
                          <a
                            href={vendor.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            {vendor.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <a
                      href={`https://www.yelp.com/search?find_desc=${encodeURIComponent(
                        gap.vendorCategory.name,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Search Yelp for {gap.vendorCategory.name}
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ))}

      {triggered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No gaps were found based on your answers yet.
        </p>
      ) : null}

      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
    </div>
  );
}
