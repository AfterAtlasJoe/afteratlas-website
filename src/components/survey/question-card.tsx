"use client";

import { useEffect, useState } from "react";

import { VendorRecommendations } from "@/components/vendors/vendor-recommendations";
import type { YelpBusiness } from "@/lib/yelp";

import { LinkedText } from "./linked-text";
import type { AnswerOptionData, QuestionData } from "./types";

type QuestionCardProps = {
  question: QuestionData;
  selectedAnswerOptionId?: string;
  disabled: boolean;
  /** Used to scope inline Yelp results when this question references a vendor category directly. */
  zipCode: string | null;
  onAnswer: (answerOptionId: string) => void;
};

/**
 * Renders one Question + its AnswerOptions. Has no idea what event type or
 * mode it belongs to — that's all in the seeded data. When the question
 * itself references a vendor category (as opposed to only surfacing one
 * later via a triggered ChecklistItem/Gap), fetches and shows real Yelp
 * results inline instead of leaving the "below is a list of..." copy with
 * nothing under it.
 */
export function QuestionCard({
  question,
  selectedAnswerOptionId,
  disabled,
  zipCode,
  onAnswer,
}: QuestionCardProps) {
  const [businesses, setBusinesses] = useState<YelpBusiness[]>([]);

  useEffect(() => {
    if (!question.vendorCategory) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ category: question.vendorCategory.slug });
    if (zipCode) params.set("zip", zipCode);
    fetch(`/api/vendors?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { businesses: [] }))
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [question.vendorCategory, zipCode]);

  const sortedOptions = question.answerOptions.slice().sort((a, b) => a.order - b.order);
  // A `select` question's description sometimes IS the per-option detail,
  // authored as one numbered list matching the options 1:1 (e.g. "1. They
  // have a surviving spouse AND..."). When it parses cleanly, that detail
  // moves onto each radio's own label instead — reading the numbered list
  // above and then matching it back down to a generically-labeled button
  // asks the user to do the matching themselves. Falls back to the plain
  // description block for anything that isn't shaped this way.
  const scenarioDescriptions =
    question.type === "select"
      ? parseNumberedDescription(question.description, sortedOptions.length)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {question.category}
      </p>
      <h2 className="text-xl font-medium">{question.prompt}</h2>
      {question.description && !scenarioDescriptions ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <LinkedText text={question.description} />
        </p>
      ) : null}
      {question.vendorCategory ? (
        <div className="rounded-md bg-black/5 p-3 text-sm dark:bg-white/10">
          <VendorRecommendations
            categoryName={question.vendorCategory.name}
            searchTerm={question.vendorCategory.yelpSearchTerm}
            businesses={businesses}
          />
        </div>
      ) : null}
      {question.type === "select" ? (
        <SelectAnswer
          question={question}
          sortedOptions={sortedOptions}
          optionLabels={scenarioDescriptions}
          selectedAnswerOptionId={selectedAnswerOptionId}
          disabled={disabled}
          onAnswer={onAnswer}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {question.answerOptions
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onAnswer(option.id)}
                className={`rounded-md border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
                  selectedAnswerOptionId === option.id
                    ? "border-foreground bg-foreground/5"
                    : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                }`}
              >
                {option.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/**
 * Splits a `description` shaped as one numbered item per answer option
 * (e.g. "1. They have a surviving spouse AND...\n\n2. They have a
 * surviving spouse AND NO...") into that per-option detail text, in
 * order. Returns null if it isn't shaped that way (no description, or
 * the parsed item count doesn't match the option count) — callers fall
 * back to the options' own short labels in that case.
 */
function parseNumberedDescription(
  description: string | null,
  optionCount: number,
): string[] | null {
  if (!description) return null;
  const items = description
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.replace(/^\d+\.\s*/, ""));
  return items.length === optionCount ? items : null;
}

/**
 * A `select` question's options are mutually exclusive scenarios read
 * together (see e.g. "Which of these scenarios best fits your
 * situation?") — radio buttons under one prompt, with a single submit,
 * rather than `bool`'s per-option instant-submit buttons. `optionLabels`
 * (from `parseNumberedDescription`), when present, replaces each option's
 * own short label with its full scenario text so the user can tell the
 * choices apart without matching a separate numbered list back down to
 * generic buttons.
 */
function SelectAnswer({
  question,
  sortedOptions,
  optionLabels,
  selectedAnswerOptionId,
  disabled,
  onAnswer,
}: {
  question: QuestionData;
  sortedOptions: AnswerOptionData[];
  optionLabels: string[] | null;
  selectedAnswerOptionId?: string;
  disabled: boolean;
  onAnswer: (answerOptionId: string) => void;
}) {
  const [selected, setSelected] = useState(selectedAnswerOptionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {sortedOptions.map((option, index) => (
          <label
            key={option.id}
            className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm transition-colors ${
              selected === option.id
                ? "border-foreground bg-foreground/5"
                : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            } ${disabled ? "opacity-50" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={selected === option.id}
              disabled={disabled}
              onChange={() => setSelected(option.id)}
              className="mt-1"
            />
            <span>{optionLabels ? optionLabels[index] : option.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !selected}
        onClick={() => selected && onAnswer(selected)}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
