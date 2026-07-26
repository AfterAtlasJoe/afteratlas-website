import type { SurveyMode } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Finds the user's in-progress SurveyResponse for this event type + mode, or starts one at the first question. */
export async function getOrCreateSurveyResponse(
  userId: string,
  eventTypeId: string,
  mode: SurveyMode,
) {
  const existing = await prisma.surveyResponse.findFirst({
    where: { userId, eventTypeId, mode, status: "in_progress" },
  });
  if (existing) {
    return existing;
  }

  const firstQuestion = await prisma.question.findFirst({
    where: { eventTypeId, mode },
    orderBy: { order: "asc" },
  });

  return prisma.surveyResponse.create({
    data: {
      userId,
      eventTypeId,
      mode,
      answers: {},
      lastQuestionId: firstQuestion?.id ?? null,
    },
  });
}
