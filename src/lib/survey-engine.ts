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
  category: string;
  order: number;
  /**
   * This question's category's position in the actual authored tour
   * through categories (not the same as sorting by uid range — see
   * seed-xlsx.ts's CANONICAL_CATEGORY_ORDER). Null for a category no
   * TopicBucket covers, e.g. the mandatory intro.
   */
  categorySequence?: number | null;
};

/**
 * Which `Question.category` values are subject to topic-selection
 * filtering (the union of every TopicBucket's categories) vs. which the
 * user actually opted into. A category outside `allBucketedCategories`
 * (e.g. the mandatory intro sequence) is never filtered.
 */
export type CategoryFilter = {
  allBucketedCategories: Set<string>;
  selectedCategories: Set<string>;
};

/**
 * The question with the lowest `order` in each category — used as that
 * category's entry point when jumping to it directly (topic-selection
 * skip, or a free section-nav click), regardless of how it's normally
 * reached in the authored tour.
 */
function categoryEntryPoints(orderedQuestions: OrderedQuestion[]): Map<string, string> {
  const entries = new Map<string, { id: string; order: number }>();
  for (const q of orderedQuestions) {
    const existing = entries.get(q.category);
    if (!existing || q.order < existing.order) {
      entries.set(q.category, { id: q.id, order: q.order });
    }
  }
  return new Map([...entries].map(([category, v]) => [category, v.id]));
}

/**
 * Given a category not selected by the user, finds the entry point of the
 * next category (by `categorySequence`, strictly after `fromSequence`)
 * that *was* selected. Returns null if none remain (survey complete for
 * this selection). uid-order fallback can't do this in general — a
 * bucketed category's own uid range can sit well before the point the
 * walk currently occupies (e.g. Guardianship's block, only entered from
 * late in the tour), so scanning forward through `orderedQuestions` would
 * never reach it.
 */
function nextSelectedCategoryEntry(
  fromSequence: number,
  orderedQuestions: OrderedQuestion[],
  selectedCategories: Set<string>,
): string | null {
  const bySequence = new Map<number, string>();
  for (const q of orderedQuestions) {
    if (q.categorySequence != null && !bySequence.has(q.categorySequence)) {
      bySequence.set(q.categorySequence, q.category);
    }
  }
  const entryPoints = categoryEntryPoints(orderedQuestions);
  const sequences = [...bySequence.keys()].sort((a, b) => a - b);
  for (const seq of sequences) {
    if (seq <= fromSequence) continue;
    const category = bySequence.get(seq)!;
    if (selectedCategories.has(category)) {
      return entryPoints.get(category) ?? null;
    }
  }
  return null;
}

/**
 * Given the full answer set so far, decides which question to show next.
 * Prefers an explicit QuestionBranch target for the answer just given;
 * otherwise falls through to the next not-skipped question in order.
 * Whatever is resolved (explicit branch or fallback) is then walked
 * forward past any question that should be skipped — either because an
 * earlier branch's `skipQuestionIds` named it, or because its
 * `skipIfChecklistItemShownId` item was already triggered this session
 * (dedup for content reachable via more than one path; see §5/§6 of the
 * spec) — landing on the first question that isn't skipped. If that
 * lands in a bucketed category the user didn't select, jumps directly to
 * the entry point of the next category (by categorySequence) that *was*
 * selected, rather than scanning uid order (see nextSelectedCategoryEntry
 * for why that fallback can't work here). Returns null once there is
 * nothing left to ask (survey complete).
 */
export function advanceSurvey(
  orderedQuestions: OrderedQuestion[],
  answeredQuestionId: string,
  answeredOptionId: string,
  answers: SurveyAnswers,
  branches: Branch[],
  triggeredChecklistItemIds: Set<string> = new Set(),
  categoryFilter?: CategoryFilter,
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

  if (categoryFilter && candidate) {
    const candidateQuestion = orderedQuestions.find((q) => q.id === candidate);
    if (
      candidateQuestion &&
      categoryFilter.allBucketedCategories.has(candidateQuestion.category) &&
      !categoryFilter.selectedCategories.has(candidateQuestion.category) &&
      candidateQuestion.categorySequence != null
    ) {
      candidate = nextSelectedCategoryEntry(
        candidateQuestion.categorySequence,
        orderedQuestions,
        categoryFilter.selectedCategories,
      );
    }
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
