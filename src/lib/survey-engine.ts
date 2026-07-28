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
  /**
   * category -> position in the topic-selection bucket picker's own
   * order (each TopicBucket's `order`, then that bucket's `categories`
   * array order) — this is what decides visit order once inside the
   * bucketed portion of the survey, matching what the bucket picker and
   * section nav show, rather than the spreadsheet's own hand-authored
   * tour through categories. A category outside this map (e.g. the
   * mandatory intro) is never redirected.
   */
  categoryOrder: Map<string, number>;
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
 * Finds the entry point of the next category — by `categoryOrder`,
 * strictly after `fromOrder` — that the user selected. Returns null if
 * none remain (survey complete for this selection, at least along this
 * ordering). uid-order scanning can't do this in general: a bucketed
 * category's own uid range can sit well before the point the walk
 * currently occupies (e.g. Guardianship's block sits at low uids despite
 * being ordered first in the bucket picker), so scanning forward through
 * `orderedQuestions` would never reach it — jumping straight to the
 * category's own entry point sidesteps that entirely.
 */
function nextSelectedCategoryEntry(
  fromOrder: number,
  orderedQuestions: OrderedQuestion[],
  selectedCategories: Set<string>,
  categoryOrder: Map<string, number>,
): string | null {
  const entryPoints = categoryEntryPoints(orderedQuestions);
  const categoriesByOrder = [...categoryOrder.entries()].sort((a, b) => a[1] - b[1]);
  for (const [category, order] of categoriesByOrder) {
    if (order <= fromOrder) continue;
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
 * spec) — landing on the first question that isn't skipped.
 *
 * If that lands in a *different* category than the question just
 * answered, the category to show is decided by `categoryFilter.categoryOrder`
 * (the bucket picker's own order) rather than whatever uid the resolved
 * branch/fallback happened to point at — the underlying graph edge only
 * guarantees *some* forward path exists (see seed-xlsx.ts's
 * ALWAYS_JUMP_TO_FIXES), not which category should come next once the
 * user has chosen an order at the topic-selection question. This also
 * rescues a true dead end (no branch, no fallback) the same way, so a
 * category whose last question has no further edge at all still advances
 * to the next selected category instead of ending the survey early.
 * Returns null once there is nothing left to ask (survey complete).
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

  if (categoryFilter) {
    const answeredQuestion = orderedQuestions.find((q) => q.id === answeredQuestionId);
    const candidateQuestion = candidate ? orderedQuestions.find((q) => q.id === candidate) : null;
    const stayedInSameCategory =
      candidateQuestion != null &&
      answeredQuestion != null &&
      candidateQuestion.category === answeredQuestion.category;

    if (!stayedInSameCategory) {
      const fromOrder =
        (answeredQuestion && categoryFilter.categoryOrder.get(answeredQuestion.category)) ?? -1;
      const redirected = nextSelectedCategoryEntry(
        fromOrder,
        orderedQuestions,
        categoryFilter.selectedCategories,
        categoryFilter.categoryOrder,
      );
      if (redirected !== null) {
        candidate = redirected;
      } else if (
        candidateQuestion &&
        categoryFilter.allBucketedCategories.has(candidateQuestion.category) &&
        !categoryFilter.selectedCategories.has(candidateQuestion.category)
      ) {
        // No selected category left ahead, and the natural candidate is
        // itself a bucketed-but-unselected one — nothing left to show.
        candidate = null;
      }
      // else: no selected category left ahead, but the natural candidate
      // isn't a bucketed dead end either (e.g. truly no more content, or
      // content outside every bucket) — leave it as the natural result.
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

type OrderedBucket = { order: number; categories: string[] };

/**
 * Category display order matching the actual survey traversal: any
 * category no TopicBucket covers (the mandatory intro, e.g. "Getting
 * Started") sorts first — it's always asked before the topic-selection
 * question, so it's always first in a real run regardless of what gets
 * selected — then each bucketed category in TopicBucket.order + its
 * position within that bucket's own `categories` list. The same shape
 * `advanceSurvey`'s own `categoryOrder` param and the section nav's
 * grouping already use, so the checklist/PDF/gaps output lines up with
 * both the survey's traversal order and its nav.
 */
/** The bucketed half of `sortCategoriesByDisplayOrder` — also what `advanceSurvey`'s own `categoryOrder` param expects, so the PATCH route builds it once here instead of duplicating the loop. */
export function bucketCategoryOrder(buckets: OrderedBucket[]): Map<string, number> {
  const order = new Map<string, number>();
  let cursor = 0;
  for (const bucket of buckets.slice().sort((a, b) => a.order - b.order)) {
    for (const category of bucket.categories) {
      if (!order.has(category)) {
        order.set(category, cursor++);
      }
    }
  }
  return order;
}

export function sortCategoriesByDisplayOrder(
  categories: string[],
  buckets: OrderedBucket[],
): string[] {
  const order = bucketCategoryOrder(buckets);
  return categories
    .slice()
    .sort((a, b) => (order.get(a) ?? -1) - (order.get(b) ?? -1));
}
