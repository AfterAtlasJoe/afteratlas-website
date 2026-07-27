"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { MultiselectGroupCard } from "./multiselect-group-card";
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
  /** Question ids visited so far, in first-encountered order. Drives the Back button and which sections have been revealed in the nav. */
  initialHistory: string[];
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
  initialHistory,
}: SurveyRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [currentQuestionId, setCurrentQuestionId] = useState(
    initialCurrentQuestionId,
  );
  const [history, setHistory] = useState<string[]>(initialHistory);
  const [submitting, setSubmitting] = useState(false);

  const orderedQuestions = useMemo(
    () => questions.slice().sort((a, b) => a.order - b.order),
    [questions],
  );
  const questionsById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  /**
   * Only categories the user has actually reached, in the order they were
   * first reached — not the full category list up front. A category stays
   * visible (and clickable) once uncovered, even after navigating back
   * before it.
   */
  const visibleCategories = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const questionId of history) {
      const category = questionsById.get(questionId)?.category;
      if (category && !seen.has(category)) {
        seen.add(category);
        ordered.push(category);
      }
    }
    return ordered;
  }, [history, questionsById]);
  const completedCategories = useMemo(() => {
    const complete = new Set<string>();
    for (const category of visibleCategories) {
      const inCategory = questions.filter((q) => q.category === category);
      if (inCategory.every((q) => answers[q.id])) {
        complete.add(category);
      }
    }
    return complete;
  }, [visibleCategories, questions, answers]);

  const currentQuestion = questionsById.get(currentQuestionId);

  /**
   * If the current question belongs to a `multiselect_group`, gather the
   * contiguous run of questions sharing that same group (in order) so
   * they render as one "select all that apply" screen instead of one
   * question at a time.
   */
  const currentGroupQuestions = useMemo(() => {
    if (!currentQuestion?.multiselectGroup) return null;
    const startIndex = orderedQuestions.findIndex(
      (q) => q.id === currentQuestion.id,
    );
    if (startIndex === -1) return null;
    const group = [orderedQuestions[startIndex]];
    for (let i = startIndex + 1; i < orderedQuestions.length; i++) {
      if (orderedQuestions[i].multiselectGroup !== currentQuestion.multiselectGroup) {
        break;
      }
      group.push(orderedQuestions[i]);
    }
    return group.length > 1 ? group : null;
  }, [currentQuestion, orderedQuestions]);

  async function submitAnswers(
    pairs: { questionId: string; answerOptionId: string }[],
  ) {
    if (submitting || pairs.length === 0) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/survey-responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pairs.length === 1 ? pairs[0] : { answers: pairs },
        ),
      });
      if (!response.ok) {
        throw new Error("Failed to save answer");
      }
      const updated = await response.json();
      setAnswers(updated.answers);
      setHistory(updated.history);
      if (updated.status === "completed" || !updated.lastQuestionId) {
        router.push(resultsHref);
        return;
      }
      setCurrentQuestionId(updated.lastQuestionId);
    } finally {
      setSubmitting(false);
    }
  }

  /** Moves to a question already in history — the Back button, or clicking an already-revealed section — without touching answers. */
  async function navigateTo(questionId: string) {
    if (submitting || questionId === currentQuestionId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/survey-responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ navigateTo: questionId }),
      });
      if (!response.ok) {
        throw new Error("Failed to navigate");
      }
      setCurrentQuestionId(questionId);
    } finally {
      setSubmitting(false);
    }
  }

  const historyIndex = history.indexOf(currentQuestionId);
  const previousQuestionId = historyIndex > 0 ? history[historyIndex - 1] : null;

  function handleBack() {
    if (previousQuestionId) {
      void navigateTo(previousQuestionId);
    }
  }

  function handleSelectCategory(category: string) {
    const firstInCategory = history.find(
      (questionId) => questionsById.get(questionId)?.category === category,
    );
    if (firstInCategory) {
      void navigateTo(firstInCategory);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 grid-cols-1 gap-8 px-6 py-12 sm:grid-cols-[220px_1fr]">
      <aside>
        <h1 className="mb-4 text-sm font-semibold text-zinc-500">
          {eventTypeName}
        </h1>
        <SectionNav
          categories={visibleCategories}
          currentCategory={currentQuestion?.category ?? visibleCategories[0]}
          completedCategories={completedCategories}
          onSelectCategory={handleSelectCategory}
        />
      </aside>
      <div>
        {previousQuestionId ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={submitting}
            className="mb-4 text-sm text-zinc-500 hover:text-foreground disabled:opacity-50"
          >
            ← Back
          </button>
        ) : null}
        {currentGroupQuestions ? (
          <MultiselectGroupCard
            questions={currentGroupQuestions}
            initialAnswers={answers}
            disabled={submitting}
            onSubmit={submitAnswers}
          />
        ) : currentQuestion ? (
          <QuestionCard
            question={currentQuestion}
            selectedAnswerOptionId={answers[currentQuestion.id]}
            disabled={submitting}
            onAnswer={(answerOptionId) =>
              submitAnswers([{ questionId: currentQuestion.id, answerOptionId }])
            }
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
