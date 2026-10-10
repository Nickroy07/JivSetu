"""
Deterministic draft clinical history.

Every statement produced here is traceable to a source:
  - "patient"  : an interview answer (question id)
  - "document" : a document extraction (document id + source line)
Nothing is inferred beyond what the sources literally say. The output is a
DRAFT for clinician review, never a diagnosis.
"""

from typing import Any

# Mirrors lib/clinicalQuestions.ts on the frontend.
QUESTIONS: dict[str, tuple[str, str]] = {
    "chief_complaint": ("Chief complaint", "Reason for visit"),
    "symptom_onset": ("History of present illness", "Onset / duration"),
    "symptom_description": ("History of present illness", "Description (patient's words)"),
    "chest_pain_onset": ("History of present illness", "Onset"),
    "chest_pain_location": ("History of present illness", "Location"),
    "chest_pain_character": ("History of present illness", "Character"),
    "chest_pain_severity": ("History of present illness", "Severity"),
    "chest_pain_radiation": ("History of present illness", "Radiation"),
    "chest_pain_aggravating": ("History of present illness", "Aggravating factors"),
    "chest_pain_relief": ("History of present illness", "Relieving factors"),
    "breathlessness": ("Review of systems", "Breathlessness"),
    "sweating": ("Review of systems", "Sweating"),
    "nausea": ("Review of systems", "Nausea / vomiting"),
    "diabetes": ("Past medical history", "Diabetes"),
    "medications": ("Drug history", "Current medicines"),
    "allergies": ("Allergy history", "Allergies"),
    "family_history": ("Family history", "Family history"),
    "personal_history": ("Personal history", "Personal history"),
}

SECTION_ORDER = [
    "Chief complaint",
    "History of present illness",
    "Review of systems",
    "Past medical history",
    "Drug history",
    "Allergy history",
    "Family history",
    "Personal history",
    "Other",
]

CORE_FIELDS = ["chief_complaint", "medications", "allergies", "diabetes", "family_history", "personal_history"]
CHEST_PAIN_FIELDS = ["chest_pain_onset", "chest_pain_severity", "chest_pain_radiation"]

UNKNOWN = {"", "unknown", "dont_know", "don't know", "not sure", "na", "n/a", "-", "skip", "skipped"}
NEGATIVE = {"no", "none", "nil", "nothing", "no medicines", "no medication", "no allergies", "nahi", "नहीं", "नाही"}

DIABETES_TERMS = ("diabet", "dm type", "t2dm", "metformin", "glimepiride", "insulin", "hba1c")


def _norm(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().replace("_", " ").split())


def _is_unknown(value: Any) -> bool:
    return _norm(value) in UNKNOWN


def _is_negative(value: Any) -> bool:
    return _norm(value) in NEGATIVE


def _humanize(value: Any) -> str:
    text = str(value).strip()
    return text.replace("_", " ") if text and " " not in text else text


def build_sections(history_data: dict[str, Any]) -> list[dict[str, Any]]:
    sections: dict[str, list[dict[str, Any]]] = {}
    for key, value in history_data.items():
        if value in (None, "", []):
            continue
        section, label = QUESTIONS.get(key, ("Other", key.replace("_", " ").capitalize()))
        sections.setdefault(section, []).append(
            {"field": key, "label": label, "value": _humanize(value), "source": {"type": "patient", "question_id": key}}
        )
    return [{"title": t, "items": sections[t]} for t in SECTION_ORDER if t in sections]


def find_missing(history_data: dict[str, Any]) -> list[dict[str, str]]:
    required = list(CORE_FIELDS)
    if _norm(history_data.get("chief_complaint")) == "chest pain":
        required += CHEST_PAIN_FIELDS
    else:
        required.append("symptom_onset")
    missing = []
    for key in required:
        if key not in history_data or _is_unknown(history_data.get(key)):
            section, label = QUESTIONS.get(key, ("Other", key))
            missing.append({"field": key, "label": label, "section": section,
                            "reason": "Not answered" if key not in history_data else "Patient was unsure"})
    return missing


def _doc_ref(doc: dict[str, Any], source_text: str | None = None) -> dict[str, Any]:
    return {"type": "document", "document_id": doc["id"], "filename": doc["filename"], "source_text": source_text}


def collect_document_facts(documents: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Flatten extractions (clinician-reviewed values win over machine values)."""
    facts: dict[str, list[dict[str, Any]]] = {"medications": [], "diagnoses": [], "lab_values": [], "allergies": []}
    for doc in documents:
        extraction = doc.get("extraction") or {}
        data = extraction.get("reviewed_data") or extraction.get("data") or {}
        reviewed = bool(extraction.get("reviewed_data"))
        for med in data.get("medications") or []:
            facts["medications"].append({"name": med.get("name"), "strength": med.get("strength"),
                                         "frequency": med.get("frequency"), "reviewed": reviewed,
                                         "source": _doc_ref(doc, med.get("source_text"))})
        for lab in data.get("lab_values") or []:
            facts["lab_values"].append({"test_name": lab.get("test_name"), "value": lab.get("value"),
                                        "unit": lab.get("unit"), "reviewed": reviewed,
                                        "source": _doc_ref(doc, lab.get("source_text"))})
        for dx in data.get("diagnoses_mentioned") or []:
            facts["diagnoses"].append({"text": dx, "reviewed": reviewed, "source": _doc_ref(doc)})
        for allergy in data.get("allergies_mentioned") or []:
            facts["allergies"].append({"text": allergy, "reviewed": reviewed, "source": _doc_ref(doc)})
    return facts


def find_conflicts(history_data: dict[str, Any], facts: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    conflicts = []
    patient = lambda key: {"type": "patient", "question_id": key, "value": _humanize(history_data.get(key))}  # noqa: E731

    if _is_negative(history_data.get("medications")) and facts["medications"]:
        conflicts.append({
            "field": "medications",
            "message": "Patient reported no current medicines, but documents list medicines.",
            "patient": patient("medications"),
            "documents": [m["source"] | {"value": m["name"]} for m in facts["medications"][:5]],
        })

    if _is_negative(history_data.get("diabetes")):
        hits = [m["source"] | {"value": m["name"]} for m in facts["medications"] if any(t in _norm(m["name"]) for t in DIABETES_TERMS)]
        hits += [d["source"] | {"value": d["text"]} for d in facts["diagnoses"] if any(t in _norm(d["text"]) for t in DIABETES_TERMS)]
        hits += [lab["source"] | {"value": f'{lab["test_name"]} {lab["value"]}'} for lab in facts["lab_values"] if "hba1c" in _norm(lab["test_name"])]
        if hits:
            conflicts.append({
                "field": "diabetes",
                "message": "Patient reported no diabetes, but documents contain diabetes-related entries.",
                "patient": patient("diabetes"),
                "documents": hits[:5],
            })

    if _is_negative(history_data.get("allergies")) and facts["allergies"]:
        negative_docs = [a for a in facts["allergies"] if not _is_negative(a["text"])]
        if negative_docs:
            conflicts.append({
                "field": "allergies",
                "message": "Patient reported no allergies, but documents mention allergies.",
                "patient": patient("allergies"),
                "documents": [a["source"] | {"value": a["text"]} for a in negative_docs[:5]],
            })
    return conflicts


def narrative(history_data: dict[str, Any], red_flags: list[Any]) -> str:
    parts = []
    complaint = history_data.get("chief_complaint")
    if complaint:
        parts.append(f"Patient reports {_humanize(complaint).lower()} as the reason for today's visit.")
    onset = history_data.get("chest_pain_onset") or history_data.get("symptom_onset")
    if onset:
        parts.append(f"Onset described as: {_humanize(onset)}.")
    severity = history_data.get("chest_pain_severity")
    if severity:
        parts.append(f"Severity reported as {_humanize(severity)}.")
    positives = [QUESTIONS[k][1].lower() for k in ("breathlessness", "sweating", "nausea") if _norm(history_data.get(k)) == "yes"]
    if positives:
        parts.append("Associated symptoms reported: " + ", ".join(positives) + ".")
    if red_flags:
        parts.append(f"{len(red_flags)} screening flag(s) require clinician attention.")
    return " ".join(parts) or "Insufficient patient-reported information to draft a narrative."


def build_case_summary(history_data: dict[str, Any], red_flags: list[Any], documents: list[dict[str, Any]]) -> dict[str, Any]:
    facts = collect_document_facts(documents)
    return {
        "kind": "auto_generated_draft",
        "disclaimer": "Automatically assembled from patient answers and document text. Not a diagnosis. Requires clinician review.",
        "narrative": narrative(history_data, red_flags),
        "sections": build_sections(history_data),
        "document_facts": facts,
        "missing_information": find_missing(history_data),
        "conflicts": find_conflicts(history_data, facts),
    }
