export type AnswerOptionData = {
  id: string;
  label: string;
  value: string;
  order: number;
};

export type QuestionData = {
  id: string;
  prompt: string;
  description: string | null;
  category: string;
  section: string | null;
  order: number;
  /** Rows sharing a value here render as one "select all that apply" screen instead of sequential single-question screens. */
  multiselectGroup: string | null;
  answerOptions: AnswerOptionData[];
};
