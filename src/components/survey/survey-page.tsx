import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findActiveSurveyResponse } from "@/lib/survey-responses";
import type { SurveyMode } from "@/generated/prisma/client";

import { NewSurveyForm } from "./new-survey-form";
import { SurveyRunner } from "./survey-runner";
import type { QuestionData } from "./types";

type SurveyPageProps = {
  eventTypeId: string;
  mode: SurveyMode;
  /** e.g. "/checklist" or "/gaps" — the response id is appended once the survey completes. */
  resultsBasePath: string;
  loginCallbackBasePath: string;
};

/**
 * Shared page body for /survey/[eventType] (mode: post_event) and
 * /plan/[eventType] (mode: planning). All mode/event-type differences are
 * data, not code — this component never branches on "death".
 */
export async function SurveyPage({
  eventTypeId,
  mode,
  resultsBasePath,
  loginCallbackBasePath,
}: SurveyPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`${loginCallbackBasePath}/${eventTypeId}`)}`,
    );
  }

  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId, active: true },
  });
  if (!eventType) {
    notFound();
  }

  const response = await findActiveSurveyResponse(
    session.user.id,
    eventTypeId,
    mode,
  );

  if (!response) {
    return (
      <NewSurveyForm
        eventTypeId={eventTypeId}
        eventTypeName={eventType.name}
        mode={mode}
      />
    );
  }

  if (response.status === "completed" || !response.lastQuestionId) {
    redirect(`${resultsBasePath}/${response.id}`);
  }

  const questions = await prisma.question.findMany({
    where: { eventTypeId, mode },
    orderBy: { order: "asc" },
    include: { answerOptions: { orderBy: { order: "asc" } } },
  });

  const questionData: QuestionData[] = questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    description: q.description,
    category: q.category,
    section: q.section,
    order: q.order,
    multiselectGroup: q.multiselectGroup,
    answerOptions: q.answerOptions,
  }));

  // Responses created before the `history` field existed have an empty
  // array — fall back to the current question so Back/section-nav still
  // have something to work with instead of showing nothing.
  const initialHistory =
    response.history.length > 0 ? response.history : [response.lastQuestionId];

  return (
    <SurveyRunner
      responseId={response.id}
      eventTypeName={response.title ?? eventType.name}
      resultsHref={`${resultsBasePath}/${response.id}`}
      questions={questionData}
      initialAnswers={(response.answers as Record<string, string>) ?? {}}
      initialCurrentQuestionId={response.lastQuestionId}
      initialHistory={initialHistory}
    />
  );
}
