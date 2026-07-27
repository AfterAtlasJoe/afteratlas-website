import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  advanceSurvey,
  resolveTriggeredItems,
  type SurveyAnswers,
} from "@/lib/survey-engine";

type AnswerPair = { questionId: string; answerOptionId: string };

function parseAnswerPairs(body: unknown): AnswerPair[] | null {
  if (
    body &&
    typeof body === "object" &&
    "questionId" in body &&
    "answerOptionId" in body
  ) {
    const { questionId, answerOptionId } = body as Record<string, unknown>;
    if (typeof questionId === "string" && typeof answerOptionId === "string") {
      return [{ questionId, answerOptionId }];
    }
    return null;
  }
  if (body && typeof body === "object" && Array.isArray((body as { answers?: unknown }).answers)) {
    const pairs = (body as { answers: unknown[] }).answers;
    const parsed: AnswerPair[] = [];
    for (const pair of pairs) {
      if (
        pair &&
        typeof pair === "object" &&
        typeof (pair as Record<string, unknown>).questionId === "string" &&
        typeof (pair as Record<string, unknown>).answerOptionId === "string"
      ) {
        parsed.push(pair as AnswerPair);
      } else {
        return null;
      }
    }
    return parsed.length > 0 ? parsed : null;
  }
  return null;
}

/**
 * Four things happen through this route, distinguished by request body shape:
 * - { title } — renames the response (used from the dashboard).
 * - { navigateTo } — moves to a question already in `history` (the "Back"
 *   button, or clicking an already-revealed section) without touching
 *   answers or history itself.
 * - { questionId, answerOptionId } — records one answer and advances.
 * - { answers: [{ questionId, answerOptionId }, ...] } — records a batch of
 *   answers at once (a `multiselect_group` screen submitting all its rows
 *   together), then advances past the last one. The response also carries
 *   `newlyTriggeredItems`: any ChecklistItem this batch triggered that
 *   wasn't already triggered before it. A multiselect batch has no
 *   per-question "info" screen the way the one-at-a-time flow does, so
 *   the client shows these as a one-screen summary before advancing.
 * Mode-agnostic either way — the branching engine (src/lib/survey-engine.ts)
 * never branches on event type.
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

  if (typeof body.navigateTo === "string") {
    const history = response.history;
    if (!history.includes(body.navigateTo)) {
      return NextResponse.json(
        { error: "navigateTo must be a question already in history" },
        { status: 400 },
      );
    }
    const updated = await prisma.surveyResponse.update({
      where: { id },
      data: { lastQuestionId: body.navigateTo },
    });
    return NextResponse.json(updated);
  }

  const pairs = parseAnswerPairs(body);
  if (!pairs) {
    return NextResponse.json(
      {
        error:
          "Provide either { title }, { navigateTo }, { questionId, answerOptionId }, or { answers: [...] }",
      },
      { status: 400 },
    );
  }

  const [orderedQuestions, branches, checklistItems] = await Promise.all([
    prisma.question.findMany({
      where: { eventTypeId: response.eventTypeId, mode: response.mode },
      orderBy: { order: "asc" },
      select: { id: true, skipIfChecklistItemShownId: true },
    }),
    prisma.questionBranch.findMany({
      where: {
        question: { eventTypeId: response.eventTypeId, mode: response.mode },
      },
    }),
    prisma.checklistItem.findMany({
      where: { eventTypeId: response.eventTypeId },
      include: { triggers: { select: { questionId: true, answerOptionId: true } } },
    }),
  ]);

  const answersBefore: SurveyAnswers = (response.answers as SurveyAnswers) ?? {};
  const triggeredBefore = new Set(
    resolveTriggeredItems(checklistItems, answersBefore).map((item) => item.id),
  );

  const answers: SurveyAnswers = { ...answersBefore };
  for (const pair of pairs) {
    answers[pair.questionId] = pair.answerOptionId;
  }

  const triggeredChecklistItemIds = new Set(
    resolveTriggeredItems(checklistItems, answers).map((item) => item.id),
  );

  // Multiselect_group screens answer several questions in one batch with
  // no per-question "info" screen in between (unlike the normal
  // one-at-a-time flow, where a triggered item's own info screen already
  // surfaces it). Surface anything newly triggered by this batch as a
  // one-screen summary before advancing, so it doesn't pass by unseen.
  const newlyTriggeredItems =
    pairs.length > 1
      ? checklistItems
          .filter((item) => triggeredChecklistItemIds.has(item.id) && !triggeredBefore.has(item.id))
          .map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            relatedLinks: item.relatedLinks,
          }))
      : [];

  const lastPair = pairs[pairs.length - 1];
  const nextQuestionId = advanceSurvey(
    orderedQuestions,
    lastPair.questionId,
    lastPair.answerOptionId,
    answers,
    branches,
    triggeredChecklistItemIds,
  );

  const history =
    nextQuestionId && !response.history.includes(nextQuestionId)
      ? [...response.history, nextQuestionId]
      : response.history;

  const updated = await prisma.surveyResponse.update({
    where: { id },
    data: {
      answers,
      lastQuestionId: nextQuestionId,
      status: nextQuestionId ? "in_progress" : "completed",
      history,
    },
  });

  return NextResponse.json({ ...updated, newlyTriggeredItems });
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
