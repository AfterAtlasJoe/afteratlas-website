import type { QuestionBranch } from "@/generated/prisma/client";

/**
 * Generic branching/trigger resolution shared by both survey modes
 * (`post_event` and `planning`). Nothing here is aware of "death" —
 * all event-type-specific behavior comes from the seeded Question /
 * QuestionBranch / ChecklistItemTrigger / GapTrigger rows passed in.
 */

/** question_id -> answer_option_id, as stored on SurveyResponse.answers. */
export type SurveyAnswers = Record<string, string>;

type Branch = Pick<
  QuestionBranch,
  "questionId" | "answerOptionId" | "nextQuestionId" | "skipQuestionIds"
>;

/** The next question to show after answering `answerOptionId` on `questionId`, or null if the section is done. */
export function resolveNextQuestionId(
  questionId: string,
  answerOptionId: string,
  branches: Branch[],
): string | null {
  const branch = branches.find(
    (b) => b.questionId === questionId && b.answerOptionId === answerOptionId,
  );
  return branch?.nextQuestionId ?? null;
}

/** Question ids to exclude entirely as a result of answering `answerOptionId` on `questionId`. */
export function resolveSkippedQuestionIds(
  questionId: string,
  answerOptionId: string,
  branches: Branch[],
): string[] {
  const branch = branches.find(
    (b) => b.questionId === questionId && b.answerOptionId === answerOptionId,
  );
  return branch?.skipQuestionIds ?? [];
}

type Trigger = { questionId: string; answerOptionId: string };

/** Whether every trigger for a given item is satisfied by the recorded answers (AND semantics across triggers). */
function isTriggered(triggers: Trigger[], answers: SurveyAnswers): boolean {
  if (triggers.length === 0) return false;
  return triggers.every((t) => answers[t.questionId] === t.answerOptionId);
}

/** Filters a library of checklist items / gaps down to the ones triggered by the given answers. */
export function resolveTriggeredItems<T extends { triggers: Trigger[] }>(
  items: T[],
  answers: SurveyAnswers,
): T[] {
  return items.filter((item) => isTriggered(item.triggers, answers));
}

type OrderedQuestion = { id: string };

/**
 * Given the full answer set so far, decides which question to show next.
 * Prefers an explicit QuestionBranch target for the answer just given;
 * otherwise falls through to the next not-skipped question in order.
 * Returns null once there is nothing left to ask (survey complete).
 */
export function advanceSurvey(
  orderedQuestions: OrderedQuestion[],
  answeredQuestionId: string,
  answeredOptionId: string,
  answers: SurveyAnswers,
  branches: Branch[],
): string | null {
  const skipped = new Set<string>();
  for (const [qId, optId] of Object.entries(answers)) {
    for (const id of resolveSkippedQuestionIds(qId, optId, branches)) {
      skipped.add(id);
    }
  }

  const explicitNext = resolveNextQuestionId(
    answeredQuestionId,
    answeredOptionId,
    branches,
  );
  if (explicitNext && !skipped.has(explicitNext)) {
    return explicitNext;
  }

  const currentIndex = orderedQuestions.findIndex(
    (q) => q.id === answeredQuestionId,
  );
  for (let i = currentIndex + 1; i < orderedQuestions.length; i++) {
    const candidate = orderedQuestions[i];
    if (!skipped.has(candidate.id) && !answers[candidate.id]) {
      return candidate.id;
    }
  }

  return null;
}

/** Groups a flat list into a Map keyed by `category`, preserving input order within each group. */
export function groupByCategory<T extends { category: string }>(
  items: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.category);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.category, [item]);
    }
  }
  return groups;
}
