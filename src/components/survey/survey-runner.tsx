"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { MultiselectGroupCard } from "./multiselect-group-card";
import { QuestionCard } from "./question-card";
import { SectionNav } from "./section-nav";
import { TopicBucketPicker, type TopicBucketData } from "./topic-bucket-picker";
import {
  TriggeredItemsSummary,
  type TriggeredItemPreview,
} from "./triggered-items-summary";
import type { QuestionData } from "./types";

type SurveyRunnerProps = {
  responseId: string;
  eventTypeName: string;
  /** Where to send the user once the survey is complete. */
  resultsHref: string;
  questions: QuestionData[];
  initialAnswers: Record<string, string>;
  initialCurrentQuestionId: string;
  /** Question ids visited so far, in first-encountered order. Drives the Back button. */
  initialHistory: string[];
  /** Used to scope inline Yelp vendor recommendations on questions that reference them directly. Null if not collected (e.g. a pre-existing response). */
  zipCode: string | null;
  /** Options for the topic_selection question's bucket picker. Empty if this eventType+mode has none defined. */
  buckets: TopicBucketData[];
  /** Question.category values chosen at the topic-selection question, if answered already. */
  initialSelectedCategories: string[];
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
  zipCode,
  buckets,
  initialSelectedCategories,
}: SurveyRunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] =
    useState<Record<string, string>>(initialAnswers);
  const [currentQuestionId, setCurrentQuestionId] = useState(
    initialCurrentQuestionId,
  );
  const [history, setHistory] = useState<string[]>(initialHistory);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialSelectedCategories,
  );
  const [submitting, setSubmitting] = useState(false);
  const [newlyTriggeredItems, setNewlyTriggeredItems] = useState<
    TriggeredItemPreview[] | null
  >(null);
  const [pendingAdvance, setPendingAdvance] = useState<{
    nextQuestionId: string | null;
    completed: boolean;
  } | null>(null);

  const orderedQuestions = useMemo(
    () => questions.slice().sort((a, b) => a.order - b.order),
    [questions],
  );
  const questionsById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );
  /** Every category, in first-encountered order across all questions (not scoped to what's been visited). */
  const allCategoriesInOrder = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const q of orderedQuestions) {
      if (!seen.has(q.category)) {
        seen.add(q.category);
        ordered.push(q.category);
      }
    }
    return ordered;
  }, [orderedQuestions]);
  /** Categories covered by any bucket — these are the ones subject to topic-selection filtering. */
  const bucketedCategories = useMemo(
    () => new Set(buckets.flatMap((bucket) => bucket.categories)),
    [buckets],
  );
  /**
   * Before the topic-selection question is answered, only categories
   * reached so far (i.e. the mandatory intro). Once buckets are chosen,
   * shows the full selected set right away — the choice was already made
   * upfront, so there's nothing left to progressively reveal — plus any
   * category no bucket covers (the same mandatory intro).
   */
  const visibleCategories = useMemo(() => {
    if (selectedCategories.length === 0) {
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
    }
    const selectedSet = new Set(selectedCategories);
    return allCategoriesInOrder.filter(
      (category) => !bucketedCategories.has(category) || selectedSet.has(category),
    );
  }, [selectedCategories, history, questionsById, allCategoriesInOrder, bucketedCategories]);
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
    extra?: Record<string, unknown>,
  ) {
    if (submitting || pairs.length === 0) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/survey-responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          pairs.length === 1
            ? { ...pairs[0], ...extra }
            : { answers: pairs, ...extra },
        ),
      });
      if (!response.ok) {
        throw new Error("Failed to save answer");
      }
      const updated = await response.json();
      setAnswers(updated.answers);
      setHistory(updated.history);
      setSelectedCategories(updated.selectedCategories);
      const completed = updated.status === "completed" || !updated.lastQuestionId;
      if (updated.newlyTriggeredItems?.length > 0) {
        setNewlyTriggeredItems(updated.newlyTriggeredItems);
        setPendingAdvance({ nextQuestionId: updated.lastQuestionId, completed });
        return;
      }
      if (completed) {
        router.push(resultsHref);
        return;
      }
      setCurrentQuestionId(updated.lastQuestionId);
    } finally {
      setSubmitting(false);
    }
  }

  /** Dismisses the "a few things to note" summary and performs the advance it was deferring. */
  function handleContinueFromSummary() {
    setNewlyTriggeredItems(null);
    if (!pendingAdvance) return;
    const { nextQuestionId, completed } = pendingAdvance;
    setPendingAdvance(null);
    if (completed) {
      router.push(resultsHref);
      return;
    }
    if (nextQuestionId) {
      setCurrentQuestionId(nextQuestionId);
    }
  }

  /** Moves to a question already in history — the Back button, or clicking an already-revealed section — without touching answers. */
  async function navigateTo(questionId: string) {
    if (submitting || questionId === currentQuestionId) return;
    setNewlyTriggeredItems(null);
    setPendingAdvance(null);
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
      const updated = await response.json();
      setHistory(updated.history);
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
    // Once buckets are chosen, the whole selected set is committed to —
    // move freely between them rather than only ones already visited.
    const firstInCategory =
      selectedCategories.length > 0
        ? orderedQuestions.find((q) => q.category === category)?.id
        : history.find((questionId) => questionsById.get(questionId)?.category === category);
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
        {newlyTriggeredItems ? (
          <TriggeredItemsSummary
            items={newlyTriggeredItems}
            onContinue={handleContinueFromSummary}
          />
        ) : currentQuestion?.type === "topic_selection" ? (
          <TopicBucketPicker
            buckets={buckets}
            disabled={submitting}
            onSubmit={(categories) => {
              const answerOptionId = currentQuestion.answerOptions[0]?.id;
              if (!answerOptionId) return;
              void submitAnswers(
                [{ questionId: currentQuestion.id, answerOptionId }],
                { selectedCategories: categories },
              );
            }}
          />
        ) : currentGroupQuestions ? (
          <MultiselectGroupCard
            questions={currentGroupQuestions}
            initialAnswers={answers}
            disabled={submitting}
            onSubmit={submitAnswers}
          />
        ) : currentQuestion ? (
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            selectedAnswerOptionId={answers[currentQuestion.id]}
            disabled={submitting}
            zipCode={zipCode}
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
