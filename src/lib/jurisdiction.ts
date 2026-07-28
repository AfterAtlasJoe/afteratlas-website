/**
 * Resolves which Jurisdiction's content a response should see, and swaps
 * in jurisdiction-neutral copy for the handful of universal
 * Question/ChecklistItem rows that have jurisdiction-specific wording
 * (a link to a particular state agency, a state-specific deadline, etc.).
 * Nothing here is aware of "death" or any specific state's rules —
 * this is purely zip code -> jurisdiction id, plus a generic text swap.
 */

/**
 * 3-digit zip prefix ranges for jurisdictions that have their own
 * dedicated content. Currently just Washington (the source spreadsheet is
 * WA-specific) — every other zip resolves to `GENERAL_JURISDICTION_ID`.
 * Add another state here (plus its own seeded content, following the
 * pattern in prisma/seed-xlsx.ts) to extend a state beyond the general
 * fallback; no other code needs to change.
 */
const STATE_ZIP_PREFIXES: { jurisdictionId: string; min: number; max: number }[] = [
  { jurisdictionId: "wa", min: 980, max: 994 },
];

export const GENERAL_JURISDICTION_ID = "general";

export function jurisdictionForZip(zipCode: string | null | undefined): string {
  const prefix = zipCode ? Number(zipCode.slice(0, 3)) : NaN;
  if (Number.isNaN(prefix)) return GENERAL_JURISDICTION_ID;
  const match = STATE_ZIP_PREFIXES.find((r) => prefix >= r.min && prefix <= r.max);
  return match?.jurisdictionId ?? GENERAL_JURISDICTION_ID;
}

type QuestionTextSource = {
  prompt: string;
  description: string | null;
  generalPrompt: string | null;
  generalDescription: string | null;
};

/** Prefers the general-jurisdiction override text, for any jurisdiction other than the one dedicated-content jurisdiction ("wa"). Falls back to the original text where no override is set. */
export function resolvedQuestionText<T extends QuestionTextSource>(
  question: T,
  jurisdictionId: string,
): { prompt: string; description: string | null } {
  if (jurisdictionId === "wa") {
    return { prompt: question.prompt, description: question.description };
  }
  return {
    prompt: question.generalPrompt ?? question.prompt,
    description: question.generalDescription ?? question.description,
  };
}

type ChecklistTextSource = {
  description: string;
  relatedLinks: string[];
  generalDescription: string | null;
  generalRelatedLinks: string[];
};

/** Same swap as `resolvedQuestionText`, for a triggered ChecklistItem's description/links. */
export function resolvedChecklistText<T extends ChecklistTextSource>(
  item: T,
  jurisdictionId: string,
): { description: string; relatedLinks: string[] } {
  if (jurisdictionId === "wa" || item.generalDescription === null) {
    return { description: item.description, relatedLinks: item.relatedLinks };
  }
  return {
    description: item.generalDescription,
    relatedLinks: item.generalRelatedLinks,
  };
}
