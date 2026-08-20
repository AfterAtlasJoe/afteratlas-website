/**
 * The mandatory intro category every EventType's questions start in before
 * any TopicBucket-driven branching begins (see prisma/seed-xlsx.ts's
 * category fallback, and survey-engine.ts's bucketCategoryOrder). Items
 * triggered here are almost always relevant regardless of what the user
 * selected, but they're orientation/context rather than to-dos — shown on
 * the checklist and in the PDF, but without a checkbox and excluded from
 * the "N of M done" count.
 */
export const UNCHECKABLE_CHECKLIST_CATEGORY = "Getting Started";

export function isCheckableCategory(category: string): boolean {
  return category !== UNCHECKABLE_CHECKLIST_CATEGORY;
}
