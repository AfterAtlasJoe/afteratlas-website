"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { QuestionCard } from "./question-card";
import { SectionNav } from "./section-nav";
import type { QuestionData } from "./types";

type SurveyRunnerProps = {
  responseId: string;
  eventTypeName: string;
  /** Where to send the user once the survey is complete. */
  resultsHref: string;
  questions: QuestionData[];
  initialAnswers: Record<string, string>;
  initialCurrentQuestionId: string;
};

/**
 * Drives one pass through a branching survey. Identical for post_event and
 * planning modes — only the questions/copy passed in and `resultsHref`
 * differ (checklist vs. gap report).
 */
export function SurveyRunner({
  responseId,
  eventTypeName,
  resultsHref,
  questions,
  initialAnswers,
  initialCurrentQuestionId,
}: SurveyRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [currentQuestionId, setCurrentQuestionId] = useState(
    initialCurrentQuestionId,
  );
  const [submitting, setSubmitting] = useState(false);

  const questionsById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  const categories = useMemo(
    () => Array.from(new Set(questions.map((q) => q.category))),
    [questions],
  );
  const completedCategories = useMemo(() => {
    const complete = new Set<string>();
    for (const category of categories) {
      const inCategory = questions.filter((q) => q.category === category);
      if (inCategory.every((q) => answers[q.id])) {
        complete.add(category);
      }
    }
    return complete;
  }, [categories, questions, answers]);

  const currentQuestion = questionsById.get(currentQuestionId);

  async function handleAnswer(answerOptionId: string) {
    if (!currentQuestion || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/survey-responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerOptionId,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save answer");
      }
      const updated = await response.json();
      setAnswers(updated.answers);
      if (updated.status === "completed" || !updated.lastQuestionId) {
        router.push(resultsHref);
        return;
      }
      setCurrentQuestionId(updated.lastQuestionId);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectCategory(category: string) {
    const firstInCategory = questions.find((q) => q.category === category);
    if (firstInCategory) {
      setCurrentQuestionId(firstInCategory.id);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-[220px_1fr]">
      <aside>
        <h1 className="mb-4 text-sm font-semibold text-zinc-500">
          {eventTypeName}
        </h1>
        <SectionNav
          categories={categories}
          currentCategory={currentQuestion?.category ?? categories[0]}
          completedCategories={completedCategories}
          onSelectCategory={handleSelectCategory}
        />
      </aside>
      <div>
        {currentQuestion ? (
          <QuestionCard
            question={currentQuestion}
            selectedAnswerOptionId={answers[currentQuestion.id]}
            disabled={submitting}
            onAnswer={handleAnswer}
          />
        ) : (
          <p className="text-sm text-zinc-500">
            No question to show. Try selecting a section on the left.
          </p>
        )}
      </div>
    </div>
  );
}
