import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { advanceSurvey, type SurveyAnswers } from "@/lib/survey-engine";

/**
 * Records one answer on an in-progress SurveyResponse and advances it,
 * using the generic branching engine (see src/lib/survey-engine.ts). Mode-
 * agnostic: works the same for post_event and planning responses.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const questionId: string | undefined = body.questionId;
  const answerOptionId: string | undefined = body.answerOptionId;
  if (!questionId || !answerOptionId) {
    return NextResponse.json(
      { error: "questionId and answerOptionId are required" },
      { status: 400 },
    );
  }

  const response = await prisma.surveyResponse.findUnique({ where: { id } });
  if (!response || response.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [orderedQuestions, branches] = await Promise.all([
    prisma.question.findMany({
      where: { eventTypeId: response.eventTypeId, mode: response.mode },
      orderBy: { order: "asc" },
      select: { id: true },
    }),
    prisma.questionBranch.findMany({
      where: {
        question: { eventTypeId: response.eventTypeId, mode: response.mode },
      },
    }),
  ]);

  const answers: SurveyAnswers = {
    ...((response.answers as SurveyAnswers) ?? {}),
    [questionId]: answerOptionId,
  };

  const nextQuestionId = advanceSurvey(
    orderedQuestions,
    questionId,
    answerOptionId,
    answers,
    branches,
  );

  const updated = await prisma.surveyResponse.update({
    where: { id },
    data: {
      answers,
      lastQuestionId: nextQuestionId,
      status: nextQuestionId ? "in_progress" : "completed",
    },
  });

  return NextResponse.json(updated);
}
