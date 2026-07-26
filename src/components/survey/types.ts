export type AnswerOptionData = {
  id: string;
  label: string;
  value: string;
  order: number;
};

export type QuestionData = {
  id: string;
  prompt: string;
  category: string;
  section: string | null;
  order: number;
  answerOptions: AnswerOptionData[];
};
