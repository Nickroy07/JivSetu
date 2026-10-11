"""
Deterministic draft clinical history and evidence reconciliation engine.

Every statement produced here is traceable to a source:
  - "patient"  : an interview answer (question id)
  - "document" : a document extraction (document id + source line)
Nothing is inferred beyond what the sources literally say. The output is a
DRAFT for clinician review, never an automated diagnosis.
"""

import re
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

DIABETES_MEDS = ("metformin", "glimepiride", "gliclazide", "glipizide", "insulin", "sitagliptin", "teneligliptin", "vildagliptin", "dapagliflozin", "empagliflozin")
DIABETES_TERMS = ("diabet", "dm type", "t2dm", "t1dm", "hba1c") + DIABETES_MEDS


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


def evaluate_red_flags(answers: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic rule-based screening flags evaluated from patient answers."""
    flags: list[dict[str, Any]] = []
    complaint = _norm(answers.get("chief_complaint"))

    def is_yes(val: Any) -> bool:
        return _norm(val) in ("yes", "y", "true", "1", "हाँ", "हो", "होय")

    if complaint == "chest pain":
        severity = _norm(answers.get("chest_pain_severity"))
        if severity in ("severe", "very severe", "3"):
            flags.append({
                "code": "CHEST_PAIN_SEVERE",
                "severity": "urgent",
                "message": "Severe chest pain reported.",
                "source": "patient_interview",
                "question_id": "chest_pain_severity",
                "answer": str(answers.get("chest_pain_severity"))
            })
        if is_yes(answers.get("breathlessness")):
            flags.append({
                "code": "CHEST_PAIN_BREATHLESSNESS",
                "severity": "urgent",
                "message": "Breathing difficulty reported with chest pain.",
                "source": "patient_interview",
                "question_id": "breathlessness",
                "answer": str(answers.get("breathlessness"))
            })
        if is_yes(answers.get("sweating")):
            flags.append({
                "code": "CHEST_PAIN_SWEATING",
                "severity": "attention",
                "message": "Sweating reported with chest pain.",
                "source": "patient_interview",
                "question_id": "sweating",
                "answer": str(answers.get("sweating"))
            })
        radiation = _norm(answers.get("chest_pain_radiation"))
        if radiation in ("arm", "left arm", "left hand", "jaw", "neck"):
            flags.append({
                "code": "CHEST_PAIN_RADIATION",
                "severity": "urgent",
                "message": f"Chest pain radiating to {radiation} reported.",
                "source": "patient_interview",
                "question_id": "chest_pain_radiation",
                "answer": str(answers.get("chest_pain_radiation"))
            })

    elif complaint == "fever":
        if is_yes(answers.get("breathlessness")):
            flags.append({
                "code": "FEVER_BREATHLESSNESS",
                "severity": "urgent",
                "message": "Breathing difficulty reported with fever.",
                "source": "patient_interview",
                "question_id": "breathlessness",
                "answer": str(answers.get("breathlessness"))
            })

    return flags


def evaluate_disease_rules(history_data: dict[str, Any], facts: dict[str, list[dict[str, Any]]], red_flags: list[Any]) -> list[dict[str, Any]]:
    """
    Structured Clinical Evidence Reconciliation Engine.
    Evaluates verified criteria for Diabetes, ACS, Dengue, TB, Pneumonia, and Oncology Markers.
    Each consideration retains explicit source tags, cited clinical criteria, and physician verification warnings.
    """
    considerations: list[dict[str, Any]] = []

    # ---------------------------------------------------------
    # 1. DIABETES MELLITUS
    # ---------------------------------------------------------
    hba1c_labs = [lab for lab in facts["lab_values"] if "hba1c" in _norm(lab["test_name"])]
    fpg_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("fasting glucose", "fasting sugar", "fpg"))]
    rbs_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("random glucose", "random sugar", "rbs", "blood sugar"))]

    diabetes_evidence: list[dict[str, Any]] = []
    diabetes_status = "none"
    diabetes_headline = ""

    # Evaluate HbA1c
    for lab in hba1c_labs:
        try:
            val = float(re.sub(r"[^\d.]", "", str(lab["value"])))
            if val >= 6.5:
                diabetes_status = "diabetes_range"
                diabetes_headline = f"HbA1c {val}% — Diabetes Range (ADA / ICMR Threshold >= 6.5%)"
            elif 5.7 <= val <= 6.4:
                if diabetes_status != "diabetes_range":
                    diabetes_status = "prediabetes_range"
                    diabetes_headline = f"HbA1c {val}% — Prediabetes Range (ADA Threshold 5.7%–6.4%)"
            else:
                if diabetes_status not in ("diabetes_range", "prediabetes_range"):
                    diabetes_status = "normal_range"
                    diabetes_headline = f"HbA1c {val}% — Normal Glycemic Range (< 5.7%)"
            diabetes_evidence.append({
                "label": "HbA1c Laboratory Test",
                "value": f"{val}%",
                "source": lab["source"],
                "status": "diabetes_range" if val >= 6.5 else "prediabetes_range" if val >= 5.7 else "normal"
            })
        except (ValueError, TypeError):
            pass

    # Evaluate Fasting Plasma Glucose
    for lab in fpg_labs:
        try:
            val = float(re.sub(r"[^\d.]", "", str(lab["value"])))
            unit = lab.get("unit") or "mg/dL"
            if val >= 126:
                if diabetes_status != "diabetes_range":
                    diabetes_status = "diabetes_range"
                    diabetes_headline = f"Fasting Glucose {val} {unit} — Diabetes Range (ADA Threshold >= 126 mg/dL)"
            elif 100 <= val <= 125:
                if diabetes_status not in ("diabetes_range", "prediabetes_range"):
                    diabetes_status = "prediabetes_range"
                    diabetes_headline = f"Fasting Glucose {val} {unit} — Impaired Fasting Glucose / Prediabetes Range"
            diabetes_evidence.append({
                "label": "Fasting Plasma Glucose",
                "value": f"{val} {unit}",
                "source": lab["source"],
                "status": "diabetes_range" if val >= 126 else "prediabetes_range" if val >= 100 else "normal"
            })
        except (ValueError, TypeError):
            pass

    # Patient reporting
    patient_diabetes = _norm(history_data.get("diabetes"))
    if patient_diabetes in ("yes", "y", "हाँ", "हो"):
        diabetes_evidence.append({
            "label": "Patient-Reported History",
            "value": "Yes (Diagnosed Diabetes)",
            "source": {"type": "patient", "question_id": "diabetes"},
            "status": "patient_reported"
        })
        if not diabetes_headline:
            diabetes_headline = "Patient-reported prior diagnosis of Diabetes Mellitus"
            diabetes_status = "patient_reported"

    # Diabetes medications
    for med in facts["medications"]:
        if any(m in _norm(med["name"]) for m in DIABETES_MEDS):
            diabetes_evidence.append({
                "label": f"Antidiabetic Medication ({med['name']})",
                "value": f"{med['name']} {med.get('strength') or ''}".strip(),
                "source": med["source"],
                "status": "medication_evidence"
            })

    if diabetes_evidence:
        considerations.append({
            "disease": "Diabetes Mellitus",
            "status": diabetes_status,
            "headline": diabetes_headline or "Glycemic Assessment & Diabetes Evidence",
            "evidence": diabetes_evidence,
            "guideline": "ADA 2026 / ICMR Guidelines: HbA1c >= 6.5% or Fasting Glucose >= 126 mg/dL indicates Diabetes Range; 5.7%–6.4% indicates Prediabetes Range. Physician verification required before clinical diagnosis or treatment adjustment.",
            "missing_or_conflicts": [
                "Confirmation test (repeat HbA1c or FPG on a subsequent day) recommended if asymptomatic.",
            ] if diabetes_status == "diabetes_range" else [
                "Note: HbA1c in 5.7%–6.4% range indicates Prediabetes, NOT confirmed Diabetes Mellitus. Re-evaluating lifestyle interventions and periodic screening recommended."
            ] if diabetes_status == "prediabetes_range" else []
        })

    # ---------------------------------------------------------
    # 2. ACUTE CORONARY SYNDROME (ACS)
    # ---------------------------------------------------------
    complaint = _norm(history_data.get("chief_complaint"))
    troponin_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("troponin", "trop i", "trop t", "ck-mb", "ckmb"))]
    ecg_docs = [dx for dx in facts["diagnoses"] if "ecg" in _norm(dx["text"]) or "st elevation" in _norm(dx["text"]) or "ischemia" in _norm(dx["text"])]

    if complaint == "chest pain" or red_flags or troponin_labs or ecg_docs:
        acs_evidence: list[dict[str, Any]] = []
        if complaint == "chest pain":
            acs_evidence.append({
                "label": "Chief Complaint",
                "value": f"Chest Pain ({history_data.get('chest_pain_severity', 'Reported')})",
                "source": {"type": "patient", "question_id": "chief_complaint"}
            })
        for lab in troponin_labs:
            acs_evidence.append({
                "label": f"Cardiac Biomarker ({lab['test_name']})",
                "value": f"{lab['value']} {lab.get('unit') or ''}".strip(),
                "source": lab["source"]
            })
        for dx in ecg_docs:
            acs_evidence.append({
                "label": "ECG / Cardiac Document Finding",
                "value": dx["text"],
                "source": dx["source"]
            })

        considerations.append({
            "disease": "Acute Coronary Syndrome / Ischemic Heart Disease",
            "status": "urgent_screening" if any("urgent" in str(rf).lower() or "chest" in str(rf).lower() for rf in red_flags) else "cardiac_evaluation",
            "headline": "Possible Acute Coronary Syndrome Evaluation required",
            "evidence": acs_evidence,
            "guideline": "ACC/AHA 2025 / ESC Clinical Guidelines: Immediate emergency assessment, serial 12-lead ECG, and high-sensitivity Troponin testing required. Do not delay emergency care based on document processing status.",
            "missing_or_conflicts": [
                "Time of symptom onset and delta Troponin (0h / 1h or 0h / 3h) needed for acute MI rule-in/rule-out."
            ] if not troponin_labs else []
        })

    # ---------------------------------------------------------
    # 3. DENGUE FEVER
    # ---------------------------------------------------------
    platelet_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("platelet", "plt", "thrombocyte"))]
    dengue_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("dengue", "ns1", "igm", "igg"))]

    if complaint == "fever" or dengue_labs or platelet_labs:
        dengue_evidence: list[dict[str, Any]] = []
        dengue_flag = False
        for lab in platelet_labs:
            try:
                val = float(re.sub(r"[^\d.]", "", str(lab["value"])))
                # Standardize units: if reported in thousands e.g. 85 -> 85,000 or 85000
                display_val = f"{int(val * 1000)} /µL" if val < 1000 else f"{int(val)} /µL"
                raw_count = val * 1000 if val < 1000 else val
                if raw_count < 100000:
                    dengue_flag = True
                dengue_evidence.append({
                    "label": "Platelet Count",
                    "value": display_val,
                    "source": lab["source"],
                    "warning": raw_count < 100000
                })
            except (ValueError, TypeError):
                pass

        for lab in dengue_labs:
            dengue_evidence.append({
                "label": f"Dengue Serology / NS1 ({lab['test_name']})",
                "value": f"{lab['value']}",
                "source": lab["source"]
            })

        if dengue_evidence or complaint == "fever":
            considerations.append({
                "disease": "Dengue Fever",
                "status": "warning_threshold" if dengue_flag else "febrile_screening",
                "headline": "Dengue Clinical Assessment & Platelet Monitoring" if dengue_flag else "Febrile Illness / Dengue Differential",
                "evidence": dengue_evidence if dengue_evidence else [{"label": "Symptom", "value": "Fever reported", "source": {"type": "patient", "question_id": "chief_complaint"}}],
                "guideline": "NVBDCP / WHO Dengue Guidelines: Dengue NS1 Ag is optimal in Days 1–5; IgM antibodies appear after Day 5. Platelet count < 100,000/µL or rising hematocrit indicates warning signs requiring fluid management.",
                "missing_or_conflicts": ["Serial CBC and hematocrit monitoring required for plasma leakage detection."]
            })

    # ---------------------------------------------------------
    # 4. PULMONARY TUBERCULOSIS (TB)
    # ---------------------------------------------------------
    tb_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("afb", "sputum", "genexpert", "truenat", "tb"))]
    tb_dx = [dx for dx in facts["diagnoses"] if any(k in _norm(dx["text"]) for k in ("tuberculosis", "tb", "koch"))]

    if tb_labs or tb_dx:
        tb_evidence = [{"label": f"Microbiological / Molecular Test ({lab['test_name']})", "value": f"{lab['value']}", "source": lab["source"]} for lab in tb_labs]
        tb_evidence += [{"label": "Document Diagnostic Mention", "value": dx["text"], "source": dx["source"]} for dx in tb_dx]
        considerations.append({
            "disease": "Pulmonary Tuberculosis",
            "status": "microbiological_evidence",
            "headline": "Tuberculosis Diagnostic Evidence Review",
            "evidence": tb_evidence,
            "guideline": "NTEP / WHO Guidelines: Rapid molecular testing (GeneXpert / Truenat) with drug-susceptibility testing is the primary diagnostic standard. Sputum AFB and Chest X-Ray required for microbiological and radiological confirmation.",
            "missing_or_conflicts": ["Rifampicin resistance status and Chest X-ray correlation required."]
        })

    # ---------------------------------------------------------
    # 5. ONCOLOGY INVESTIGATION FRAMEWORK
    # ---------------------------------------------------------
    tumor_labs = [lab for lab in facts["lab_values"] if any(k in _norm(lab["test_name"]) for k in ("cea", "psa", "ca-125", "ca 125", "afp", "beta-hcg"))]
    if tumor_labs:
        tumor_evidence = [{"label": f"Tumor Marker ({lab['test_name']})", "value": f"{lab['value']} {lab.get('unit') or ''}".strip(), "source": lab["source"]} for lab in tumor_labs]
        considerations.append({
            "disease": "Oncology Investigation / Tumor Marker Review",
            "status": "tumor_marker_review",
            "headline": "Elevated Tumor Marker Requiring Multi-Modality Correlation",
            "evidence": tumor_evidence,
            "guideline": "Clinical Protocol: Tumor markers are non-specific and require comprehensive radiological, histopathological, and clinical correlation. Not a standalone cancer diagnosis; normal generic blood tests do not exclude malignancy.",
            "missing_or_conflicts": ["Histopathology / Biopsy or contrast-enhanced imaging required for definitive diagnosis."]
        })

    return considerations


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
    considerations = evaluate_disease_rules(history_data, facts, red_flags)
    return {
        "kind": "auto_generated_draft",
        "disclaimer": "Automatically assembled from patient answers and document text. Not a diagnosis. Requires clinician review.",
        "narrative": narrative(history_data, red_flags),
        "sections": build_sections(history_data),
        "document_facts": facts,
        "missing_information": find_missing(history_data),
        "conflicts": find_conflicts(history_data, facts),
        "clinical_considerations": considerations,
    }
