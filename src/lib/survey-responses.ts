import type { SurveyMode } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Finds the user's in-progress SurveyResponse for this event type + mode, if
 * one exists. Completed responses are reached directly via their own
 * /checklist or /gaps URL (from the dashboard) — visiting /survey or /plan
 * again always resumes an in-progress attempt or starts a new named one,
 * so users can accumulate multiple completed checklists of the same type
 * (e.g. one per family member) instead of only ever having one.
 */
export async function findActiveSurveyResponse(
  userId: string,
  eventTypeId: string,
  mode: SurveyMode,
) {
  return prisma.surveyResponse.findFirst({
    where: { userId, eventTypeId, mode, status: "in_progress" },
  });
}

/** Starts a new SurveyResponse at the first question, with a user-chosen title. */
export async function createSurveyResponse(
  userId: string,
  eventTypeId: string,
  mode: SurveyMode,
  title: string,
) {
  const firstQuestion = await prisma.question.findFirst({
    where: { eventTypeId, mode },
    orderBy: { order: "asc" },
  });

  return prisma.surveyResponse.create({
    data: {
      userId,
      eventTypeId,
      mode,
      title,
      answers: {},
      lastQuestionId: firstQuestion?.id ?? null,
      history: firstQuestion ? [firstQuestion.id] : [],
    },
  });
}
