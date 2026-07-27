export type AnswerOptionData = {
  id: string;
  label: string;
  value: string;
  order: number;
};

export type QuestionData = {
  id: string;
  /** "topic_selection" gets the bucket picker instead of a normal QuestionCard — see SurveyRunner. */
  type: "bool" | "select" | "info" | "topic_selection";
  prompt: string;
  description: string | null;
  category: string;
  section: string | null;
  order: number;
  /** Rows sharing a value here render as one "select all that apply" screen instead of sequential single-question screens. */
  multiselectGroup: string | null;
  /** Set when this question's own copy references vendor recommendations directly (see Question.vendorCategoryId). */
  vendorCategory: { slug: string; name: string; yelpSearchTerm: string } | null;
  answerOptions: AnswerOptionData[];
};
