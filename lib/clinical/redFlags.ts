// ============================================================
// JIVSETU — CLINICAL RED FLAG ENGINE
// Rule-based screening layer.
// IMPORTANT: This is NOT a diagnostic engine.
// It identifies patient-reported findings that should receive
// physician attention.
// ============================================================

export type RedFlagSeverity = "urgent" | "attention";

export type RedFlag = {
  code: string;
  severity: RedFlagSeverity;
  message: string;
  source: "patient_interview";
  question_id: string;
  answer: string;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isYes(value: unknown): boolean {
  return [
    "yes",
    "y",
    "true",
    "1",
    "हो",
    "होय",
    "हाँ",
    "हां",
  ].includes(normalize(value));
}

function hasAny(value: unknown, values: string[]): boolean {
  const normalized = normalize(value);
  return values.includes(normalized);
}

export function evaluateRedFlags(
  answers: Record<string, string>
): RedFlag[] {
  const flags: RedFlag[] = [];

  const complaint = normalize(answers["chief_complaint"]);

  const add = (
    code: string,
    severity: RedFlagSeverity,
    message: string,
    questionId: string
  ) => {
    const answer = String(answers[questionId] ?? "");

    flags.push({
      code,
      severity,
      message,
      source: "patient_interview",
      question_id: questionId,
      answer,
    });
  };

  // ==========================================================
  // CHEST PAIN
  // ==========================================================

  if (complaint === "chest_pain") {
    const severity = normalize(
      answers["chest_pain_severity"]
    );

    if (
      hasAny(severity, [
        "severe",
        "very_severe",
        "3",
      ])
    ) {
      add(
        "CHEST_PAIN_SEVERE",
        "urgent",
        "Severe chest pain reported.",
        "chest_pain_severity"
      );
    }

    if (
      isYes(answers["breathlessness"]) ||
      isYes(answers["breathing_difficulty"]) ||
      isYes(answers["difficulty_breathing"])
    ) {
      const questionId =
        isYes(answers["breathlessness"])
          ? "breathlessness"
          : isYes(answers["breathing_difficulty"])
            ? "breathing_difficulty"
            : "difficulty_breathing";

      add(
        "CHEST_PAIN_BREATHLESSNESS",
        "urgent",
        "Breathing difficulty reported with chest pain.",
        questionId
      );
    }

    if (isYes(answers["sweating"])) {
      add(
        "CHEST_PAIN_SWEATING",
        "attention",
        "Sweating reported with chest pain.",
        "sweating"
      );
    }

    const radiation = normalize(
      answers["chest_pain_radiation"]
    );

    if (
      hasAny(radiation, [
        "left_arm",
        "left_hand",
        "arm_left",
      ])
    ) {
      add(
        "CHEST_PAIN_RADIATION_LEFT_ARM",
        "urgent",
        "Chest pain radiating to the left arm reported.",
        "chest_pain_radiation"
      );
    }

    if (
      hasAny(radiation, [
        "jaw",
        "neck",
        "jaw_neck",
      ])
    ) {
      add(
        "CHEST_PAIN_RADIATION_JAW_NECK",
        "urgent",
        "Chest pain radiating to the jaw or neck reported.",
        "chest_pain_radiation"
      );
    }

    if (
      hasAny(radiation, [
        "back",
        "upper_back",
      ])
    ) {
      add(
        "CHEST_PAIN_RADIATION_BACK",
        "attention",
        "Chest pain radiating to the back reported.",
        "chest_pain_radiation"
      );
    }

    if (
      isYes(answers["fainting"]) ||
      isYes(answers["syncope"]) ||
      isYes(answers["loss_of_consciousness"])
    ) {
      const questionId =
        isYes(answers["fainting"])
          ? "fainting"
          : isYes(answers["syncope"])
            ? "syncope"
            : "loss_of_consciousness";

      add(
        "CHEST_PAIN_SYNCOPE",
        "urgent",
        "Fainting or loss of consciousness reported with chest pain.",
        questionId
      );
    }

    if (isYes(answers["sudden_onset"])) {
      add(
        "CHEST_PAIN_SUDDEN_ONSET",
        "attention",
        "Sudden onset of chest pain reported.",
        "sudden_onset"
      );
    }

    if (isYes(answers["palpitations"])) {
      add(
        "CHEST_PAIN_PALPITATIONS",
        "attention",
        "Palpitations reported with chest pain.",
        "palpitations"
      );
    }
  }

  // --- Fever screening flags ---
  if (complaint === "fever") {
    if (isYes(answers["breathlessness"])) {
      add(
        "FEVER_BREATHLESSNESS",
        "urgent",
        "Breathing difficulty reported with fever.",
        "breathlessness"
      );
    }

    if (isYes(answers["fever_chills"])) {
      add(
        "FEVER_WITH_CHILLS",
        "attention",
        "Fever with chills or shivering reported.",
        "fever_chills"
      );
    }

    const temp = answers["fever_temperature"];
    if (temp && (temp.includes("103") || temp.includes("104") || temp.includes("105"))) {
      add(
        "HIGH_GRADE_FEVER",
        "urgent",
        "High-grade fever (>103°F) reported.",
        "fever_temperature"
      );
    }

    const otherSymptom = answers["fever_cough_vomiting"];
    if (otherSymptom === "vomiting") {
      add(
        "FEVER_VOMITING",
        "attention",
        "Fever associated with vomiting or dehydration risk.",
        "fever_cough_vomiting"
      );
    } else if (otherSymptom === "rash") {
      add(
        "FEVER_WITH_RASH",
        "urgent",
        "Fever with skin rash reported (needs prompt examination).",
        "fever_cough_vomiting"
      );
    }
  }

  // Prevent duplicate codes if multiple aliases refer to
  // the same clinical finding.
  return Array.from(
    new Map(flags.map((flag) => [flag.code, flag])).values()
  );
}