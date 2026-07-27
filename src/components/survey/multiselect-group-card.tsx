import { useState } from "react";

import { LinkedText } from "./linked-text";
import type { QuestionData } from "./types";

type MultiselectGroupCardProps = {
  questions: QuestionData[];
  initialAnswers: Record<string, string>;
  disabled: boolean;
  onSubmit: (answers: { questionId: string; answerOptionId: string }[]) => void;
};

/**
 * Renders a `multiselect_group` as one "select all that apply" screen: each
 * member question gets its own row of answer options, and everything
 * submits together in one batch. Each member still gets its own
 * ChecklistItem/link if answered yes — the grouping is presentational only.
 */
export function MultiselectGroupCard({
  questions,
  initialAnswers,
  disabled,
  onSubmit,
}: MultiselectGroupCardProps) {
  const [selections, setSelections] =
    useState<Record<string, string>>(initialAnswers);

  const allAnswered = questions.every((q) => selections[q.id]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {questions[0]?.category}
      </p>
      <h2 className="text-xl font-medium">Select all that apply</h2>
      <div className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
        {questions.map((question) => (
          <div key={question.id} className="flex flex-col gap-2 py-4 first:pt-0">
            <p className="text-sm font-medium">{question.prompt}</p>
            {question.description ? (
              <p className="text-xs text-zinc-500">
                <LinkedText text={question.description} />
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {question.answerOptions
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setSelections((prev) => ({
                        ...prev,
                        [question.id]: option.id,
                      }))
                    }
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                      selections[question.id] === option.id
                        ? "border-foreground bg-foreground/5"
                        : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !allAnswered}
        onClick={() =>
          onSubmit(
            questions.map((q) => ({
              questionId: q.id,
              answerOptionId: selections[q.id],
            })),
          )
        }
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
