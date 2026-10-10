import { ClinicalQuestion, clinicalQuestions } from "@/lib/clinicalQuestions";

export type Answers = Record<string, string>;

/** Questions that apply given the answers so far (branching by chief complaint). */
export function visibleQuestions(answers: Answers): ClinicalQuestion[] {
  const complaint = answers.chief_complaint;

  return clinicalQuestions.filter((q) => {
    // Chief complaint is always visible
    if (q.id === "chief_complaint") return true;

    // Fever-specific branch
    if (q.id.startsWith("fever_")) {
      return complaint === "fever";
    }

    // Chest pain-specific branch
    if (q.id.startsWith("chest_pain_")) {
      return complaint === "chest_pain";
    }

    // General symptom onset & description apply to non-specialized complaints (or breathing, pain, other)
    if (q.id.startsWith("symptom_")) {
      return complaint !== "chest_pain" && complaint !== "fever";
    }

    // Common review of systems and history questions apply to all
    return true;
  });
}