import type { QuestionData } from "./types";

type QuestionCardProps = {
  question: QuestionData;
  selectedAnswerOptionId?: string;
  disabled: boolean;
  onAnswer: (answerOptionId: string) => void;
};

/** Renders one Question + its AnswerOptions. Has no idea what event type or mode it belongs to — that's all in the seeded data. */
export function QuestionCard({
  question,
  selectedAnswerOptionId,
  disabled,
  onAnswer,
}: QuestionCardProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {question.category}
      </p>
      <h2 className="text-xl font-medium">{question.prompt}</h2>
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
    </div>
  );
}
