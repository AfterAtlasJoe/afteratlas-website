import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  groupByCategory,
  resolveTriggeredItems,
  type SurveyAnswers,
} from "@/lib/survey-engine";
import { searchYelpBusinesses } from "@/lib/yelp";
import { ChecklistBody } from "@/components/checklist/checklist-body";

export const dynamic = "force-dynamic";

export default async function ChecklistPage({
  params,
}: {
  params: Promise<{ responseId: string }>;
}) {
  const { responseId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/checklist/${responseId}`)}`);
  }

  const response = await prisma.surveyResponse.findUnique({
    where: { id: responseId },
    include: { eventType: true },
  });
  if (
    !response ||
    response.userId !== session.user.id ||
    response.mode !== "post_event"
  ) {
    notFound();
  }

  const checklistItems = await prisma.checklistItem.findMany({
    where: { eventTypeId: response.eventTypeId },
    include: {
      triggers: { select: { questionId: true, answerOptionId: true } },
      vendorCategory: true,
    },
  });

  const triggered = resolveTriggeredItems(
    checklistItems,
    (response.answers as SurveyAnswers) ?? {},
  );
  const grouped = groupByCategory(triggered);

  const vendorCategories = new Map(
    triggered
      .map((item) => item.vendorCategory)
      .filter((category) => category !== null)
      .map((category) => [category.id, category]),
  );
  const vendorResultsByCategoryId = Object.fromEntries(
    await Promise.all(
      Array.from(vendorCategories.values()).map(async (category) => {
        const businesses = await searchYelpBusinesses(
          category.name,
          response.zipCode,
        );
        return [category.id, businesses] as const;
      }),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {response.title ?? `Your ${response.eventType.name} checklist`}
        </h1>
        <a
          href={`/api/checklist/${responseId}/pdf`}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium dark:border-white/10"
        >
          Download PDF
        </a>
      </div>

      {triggered.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No checklist items were triggered by your answers yet.
        </p>
      ) : (
        <ChecklistBody
          responseId={responseId}
          groups={Array.from(grouped.entries()).map(([category, items]) => ({
            category,
            items,
          }))}
          vendorResultsByCategoryId={vendorResultsByCategoryId}
          totalCount={triggered.length}
          initialCompletedIds={response.completedChecklistItemIds}
        />
      )}

      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
    </div>
  );
}
