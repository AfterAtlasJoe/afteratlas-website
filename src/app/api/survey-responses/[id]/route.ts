import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { advanceSurvey, type SurveyAnswers } from "@/lib/survey-engine";

/**
 * Two things happen through this route, distinguished by request body shape:
 * - { title } — renames the response (used from the dashboard).
 * - { questionId, answerOptionId } — records an answer and advances the
 *   survey, using the generic branching engine (see
 *   src/lib/survey-engine.ts). Mode-agnostic either way.
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
  const response = await prisma.surveyResponse.findUnique({ where: { id } });
  if (!response || response.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    }
    const updated = await prisma.surveyResponse.update({
      where: { id },
      data: { title },
    });
    return NextResponse.json(updated);
  }

  const questionId: string | undefined = body.questionId;
  const answerOptionId: string | undefined = body.answerOptionId;
  if (!questionId || !answerOptionId) {
    return NextResponse.json(
      { error: "questionId and answerOptionId (or title) are required" },
      { status: 400 },
    );
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const response = await prisma.surveyResponse.findUnique({ where: { id } });
  if (!response || response.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.surveyResponse.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
