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
 * Five things happen through this route, distinguished by request body shape:
 * - { title } — renames the response (used from the dashboard).
 * - { toggleChecklistItemId } — flips a ChecklistItem id in/out of
 *   `completedChecklistItemIds` (the checklist page's "mark as done"
 *   checkbox). Independent of `answers`/triggering — a manual to-do
 *   state layered on top.
 * - { navigateTo } — the "Back" button, or a section-nav click. Moves to
 *   any question already in `history`, or (without being in history yet)
 *   any question in a category the user selected at the topic-selection
 *   question — letting nav move freely within the chosen set — without
 *   touching answers.
 * - { questionId, answerOptionId, selectedCategories? } — records one
 *   answer and advances. `selectedCategories` is only valid when
 *   answering a `topic_selection` question (the bucket picker); it's
 *   stored on the response and, from then on, any Question whose
 *   category is covered by some TopicBucket but wasn't selected is
 *   skipped entirely (categories outside every bucket, e.g. the intro
 *   sequence, are never filtered).
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

  if (typeof body.toggleChecklistItemId === "string") {
    const itemId = body.toggleChecklistItemId;
    const completedChecklistItemIds = response.completedChecklistItemIds.includes(itemId)
      ? response.completedChecklistItemIds.filter((id) => id !== itemId)
      : [...response.completedChecklistItemIds, itemId];
    const updated = await prisma.surveyResponse.update({
      where: { id },
      data: { completedChecklistItemIds },
    });
    return NextResponse.json(updated);
  }

  if (typeof body.navigateTo === "string") {
    const targetId = body.navigateTo;
    let allowed = response.history.includes(targetId);

    if (!allowed) {
      // Not visited yet — allowed only if it's a real question in a
      // category the user has actually selected (or one no bucket covers
      // at all), so choosing buckets upfront lets you jump freely among
      // them rather than only ones you've already passed through.
      const [targetQuestion, topicBuckets] = await Promise.all([
        prisma.question.findFirst({
          where: { id: targetId, eventTypeId: response.eventTypeId, mode: response.mode },
          select: { category: true },
        }),
        prisma.topicBucket.findMany({
          where: { eventTypeId: response.eventTypeId, mode: response.mode },
        }),
      ]);
      const allBucketedCategories = new Set(topicBuckets.flatMap((bucket) => bucket.categories));
      allowed = Boolean(
        targetQuestion &&
          (!allBucketedCategories.has(targetQuestion.category) ||
            response.selectedCategories.includes(targetQuestion.category)),
      );
    }

    if (!allowed) {
      return NextResponse.json(
        { error: "navigateTo must be a question already visited or in a selected category" },
        { status: 400 },
      );
    }

    const history = response.history.includes(targetId)
      ? response.history
      : [...response.history, targetId];

    const updated = await prisma.surveyResponse.update({
      where: { id },
      data: { lastQuestionId: targetId, history },
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

  let selectedCategoriesInput: string[] | null = null;
  if (Array.isArray(body.selectedCategories)) {
    if (
      body.selectedCategories.length === 0 ||
      !body.selectedCategories.every((c: unknown) => typeof c === "string")
    ) {
      return NextResponse.json(
        { error: "selectedCategories must be a non-empty array of strings" },
        { status: 400 },
      );
    }
    selectedCategoriesInput = body.selectedCategories;
  }

  const [orderedQuestions, branches, checklistItems, topicBuckets] = await Promise.all([
    prisma.question.findMany({
      where: { eventTypeId: response.eventTypeId, mode: response.mode },
      orderBy: { order: "asc" },
      select: {
        id: true,
        type: true,
        category: true,
        order: true,
        skipIfChecklistItemShownId: true,
      },
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
    prisma.topicBucket.findMany({
      where: { eventTypeId: response.eventTypeId, mode: response.mode },
    }),
  ]);

  if (selectedCategoriesInput) {
    const targetQuestion = orderedQuestions.find((q) => q.id === pairs[0].questionId);
    if (!targetQuestion || targetQuestion.type !== "topic_selection") {
      return NextResponse.json(
        { error: "selectedCategories can only be set when answering a topic_selection question" },
        { status: 400 },
      );
    }
  }

  const allBucketedCategories = new Set(topicBuckets.flatMap((bucket) => bucket.categories));
  const selectedCategories = new Set(selectedCategoriesInput ?? response.selectedCategories);
  // Visit order once inside the bucketed portion: each TopicBucket's own
  // `order`, then that bucket's `categories` array order — matching the
  // bucket picker and section nav rather than the spreadsheet's tour.
  const categoryOrder = new Map<string, number>();
  let categoryOrderCursor = 0;
  for (const bucket of topicBuckets.slice().sort((a, b) => a.order - b.order)) {
    for (const category of bucket.categories) {
      if (!categoryOrder.has(category)) {
        categoryOrder.set(category, categoryOrderCursor++);
      }
    }
  }

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
    { allBucketedCategories, selectedCategories, categoryOrder },
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
      ...(selectedCategoriesInput ? { selectedCategories: selectedCategoriesInput } : {}),
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
