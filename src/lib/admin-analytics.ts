import { jurisdictionForZip } from "@/lib/jurisdiction";
import { resolveTriggeredItems, type SurveyAnswers } from "@/lib/survey-engine";

/**
 * Everything here is computed from data the app already collects
 * (SurveyResponse rows + the seeded Question/ChecklistItem graph) — no
 * separate analytics/tracking table. Two real limits worth knowing:
 * - Nothing here sees a visit that never started a survey (that's
 *   Vercel's own traffic dashboard, a separate tool — see the admin page).
 * - "Time to complete" is wall-clock (createdAt -> updatedAt), not active
 *   engagement time, since a response can be resumed across days.
 */

type ResponseRow = {
  id: string;
  status: string;
  mode: string;
  zipCode: string | null;
  answers: unknown;
  selectedCategories: string[];
  lastQuestionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type QuestionLookup = { id: string; category: string };

type ChecklistItemForTally = {
  id: string;
  title: string;
  triggers: { questionId: string; answerOptionId: string }[];
};

export type AdminAnalytics = {
  totalResponses: number;
  completedResponses: number;
  completionRate: number;
  avgQuestionsAnswered: number;
  avgMinutesToComplete: number | null;
  modeSplit: { mode: string; count: number }[];
  jurisdictionSplit: { jurisdiction: string; count: number }[];
  categoryPopularity: { category: string; count: number }[];
  abandonmentByCategory: { category: string; count: number }[];
  topChecklistItems: { title: string; count: number }[];
  topZipCodes: { zipCode: string; count: number }[];
  responsesPerDay: { date: string; count: number }[];
};

export function computeAdminAnalytics(
  responses: ResponseRow[],
  questions: QuestionLookup[],
  checklistItems: ChecklistItemForTally[],
): AdminAnalytics {
  const questionCategoryById = new Map(questions.map((q) => [q.id, q.category]));

  const totalResponses = responses.length;
  const completed = responses.filter((r) => r.status === "completed");
  const completionRate = totalResponses === 0 ? 0 : completed.length / totalResponses;

  const answeredCounts = responses.map(
    (r) => Object.keys((r.answers as SurveyAnswers) ?? {}).length,
  );
  const avgQuestionsAnswered =
    answeredCounts.length === 0
      ? 0
      : answeredCounts.reduce((sum, n) => sum + n, 0) / answeredCounts.length;

  const completionMinutes = completed.map(
    (r) => (r.updatedAt.getTime() - r.createdAt.getTime()) / 60_000,
  );
  const avgMinutesToComplete =
    completionMinutes.length === 0
      ? null
      : completionMinutes.reduce((sum, n) => sum + n, 0) / completionMinutes.length;

  const modeSplit = tally(responses.map((r) => r.mode));
  const jurisdictionSplit = tally(responses.map((r) => jurisdictionForZip(r.zipCode)));
  const categoryPopularity = tally(responses.flatMap((r) => r.selectedCategories));

  const abandonmentByCategory = tally(
    responses
      .filter((r) => r.status !== "completed" && r.lastQuestionId)
      .map((r) => questionCategoryById.get(r.lastQuestionId!))
      .filter((category): category is string => Boolean(category)),
  );

  const checklistItemCounts = new Map<string, number>();
  for (const response of responses) {
    const answers = (response.answers as SurveyAnswers) ?? {};
    const triggered = resolveTriggeredItems(checklistItems, answers);
    for (const item of triggered) {
      checklistItemCounts.set(item.title, (checklistItemCounts.get(item.title) ?? 0) + 1);
    }
  }
  const topChecklistItems = [...checklistItemCounts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const zipCounts = tally(
    responses.map((r) => r.zipCode).filter((zip): zip is string => Boolean(zip)),
  );
  const topZipCodes = zipCounts
    .map(({ value: zipCode, count }) => ({ zipCode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const dayCounts = new Map<string, number>();
  for (const response of responses) {
    const day = response.createdAt.toISOString().slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const responsesPerDay = [...dayCounts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalResponses,
    completedResponses: completed.length,
    completionRate,
    avgQuestionsAnswered,
    avgMinutesToComplete,
    modeSplit: modeSplit.map(({ value: mode, count }) => ({ mode, count })),
    jurisdictionSplit: jurisdictionSplit.map(({ value: jurisdiction, count }) => ({
      jurisdiction,
      count,
    })),
    categoryPopularity: categoryPopularity
      .map(({ value: category, count }) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    abandonmentByCategory: abandonmentByCategory
      .map(({ value: category, count }) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    topChecklistItems,
    topZipCodes,
    responsesPerDay,
  };
}

/** Counts occurrences of each string value. */
function tally(values: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}
