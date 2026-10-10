import { ClinicalQuestion, clinicalQuestions } from "@/lib/clinicalQuestions";

export type Answers = Record<string, string>;

/** Questions that apply given the answers so far (chest-pain branch vs general). */
export function visibleQuestions(answers: Answers): ClinicalQuestion[] {
  const chestPain = answers.chief_complaint === "chest_pain";
  return clinicalQuestions.filter((q) =>
    chestPain ? !q.id.startsWith("symptom_") : !q.id.startsWith("chest_pain_")
  );
}
