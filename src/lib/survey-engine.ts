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

/**
 * Whether a given item has been triggered by the recorded answers. Each
 * trigger row is an independent sufficient path — content reachable via
 * more than one branch (a convergence point in the graph) can have
 * several trigger rows, any one of which is enough; a session only ever
 * satisfies one at a time since the underlying branches are mutually
 * exclusive.
 */
function isTriggered(triggers: Trigger[], answers: SurveyAnswers): boolean {
  if (triggers.length === 0) return false;
  return triggers.some((t) => answers[t.questionId] === t.answerOptionId);
}

/** Filters a library of checklist items / gaps down to the ones triggered by the given answers. */
export function resolveTriggeredItems<T extends { triggers: Trigger[] }>(
  items: T[],
  answers: SurveyAnswers,
): T[] {
  return items.filter((item) => isTriggered(item.triggers, answers));
}

type OrderedQuestion = {
  id: string;
  /** Set only if this question should be skipped once the referenced ChecklistItem has already been triggered this session. */
  skipIfChecklistItemShownId?: string | null;
};

/**
 * Given the full answer set so far, decides which question to show next.
 * Prefers an explicit QuestionBranch target for the answer just given;
 * otherwise falls through to the next not-skipped question in order.
 * Whatever is resolved (explicit branch or fallback) is then walked
 * forward past any question that should be skipped — either because an
 * earlier branch's `skipQuestionIds` named it, or because its
 * `skipIfChecklistItemShownId` item was already triggered this session
 * (dedup for content reachable via more than one path; see §5/§6 of the
 * spec) — landing on the first question that isn't skipped.
 * Returns null once there is nothing left to ask (survey complete).
 */
export function advanceSurvey(
  orderedQuestions: OrderedQuestion[],
  answeredQuestionId: string,
  answeredOptionId: string,
  answers: SurveyAnswers,
  branches: Branch[],
  triggeredChecklistItemIds: Set<string> = new Set(),
): string | null {
  const skipped = new Set<string>();
  for (const [qId, optId] of Object.entries(answers)) {
    for (const id of resolveSkippedQuestionIds(qId, optId, branches)) {
      skipped.add(id);
    }
  }
  for (const q of orderedQuestions) {
    if (
      q.skipIfChecklistItemShownId &&
      triggeredChecklistItemIds.has(q.skipIfChecklistItemShownId)
    ) {
      skipped.add(q.id);
    }
  }

  function nextInOrderAfter(id: string): string | null {
    const idx = orderedQuestions.findIndex((q) => q.id === id);
    for (let i = idx + 1; i < orderedQuestions.length; i++) {
      const candidate = orderedQuestions[i];
      if (!skipped.has(candidate.id) && !answers[candidate.id]) {
        return candidate.id;
      }
    }
    return null;
  }

  let candidate =
    resolveNextQuestionId(answeredQuestionId, answeredOptionId, branches) ??
    nextInOrderAfter(answeredQuestionId);

  // Defensive cap: guards against a data cycle producing an infinite loop.
  let guard = 0;
  while (candidate && skipped.has(candidate) && guard < orderedQuestions.length) {
    candidate = nextInOrderAfter(candidate);
    guard++;
  }

  return candidate;
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
