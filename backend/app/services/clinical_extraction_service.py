import re
from datetime import datetime
from typing import Any


MONTHS = (
    "january|february|march|april|may|june|july|august|"
    "september|october|november|december"
)

DATE_PATTERNS = [
    rf"\b\d{{1,2}}[/-]\d{{1,2}}[/-]\d{{2,4}}\b",
    rf"\b\d{{1,2}}\s+(?:{MONTHS})\s+\d{{4}}\b",
    rf"\b(?:{MONTHS})\s+\d{{1,2}},?\s+\d{{4}}\b",
]

LAB_PATTERN = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z0-9 .()/+-]{2,50}?)"
    r"\s*[:\-]\s*"
    r"(?P<value>\d+(?:\.\d+)?)"
    r"\s*(?P<unit>[A-Za-z%µ/0-9^.-]*)",
    re.I,
)

FREQUENCIES = (
    r"once daily|twice daily|thrice daily|daily|at night|before meals|after meals|"
    r"od|bd|bid|tid|tds|qid|qhs|hs|sos|stat"
)

MEDICATION_PATTERN = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z0-9 .+/-]{1,60}?)"
    r"(?:\s*(?P<strength>\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)))?"
    r"(?:\s*[-,x]?\s*(?P<frequency>" + FREQUENCIES + r"))?"
    r"\s*(?:[-,(].*)?$",
    re.I,
)


def _first_match(patterns: list[str], text: str) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(0).strip()
    return None


def _extract_labeled(text: str, labels: list[str]) -> str | None:
    for label in labels:
        pattern = rf"(?:{re.escape(label)})\s*[:\-]\s*([^\n|]+)"
        match = re.search(pattern, text, re.I)
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def extract_document_date(text: str) -> str | None:
    raw = _first_match(DATE_PATTERNS, text)
    if not raw:
        return None

    candidates = [
        "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
        "%d %B %Y", "%B %d, %Y", "%B %d %Y",
    ]

    for fmt in candidates:
        try:
            return datetime.strptime(raw, fmt).date().isoformat()
        except ValueError:
            pass

    return raw


def extract_medications(text: str) -> list[dict[str, Any]]:
    medications: list[dict[str, Any]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    for line in lines:
        if not re.search(
            r"\b(tab(?:let)?|cap(?:sule)?|syrup|inj(?:ection)?|medicine|"
            r"medication)\b",
            line,
            re.I,
        ):
            continue

        cleaned = re.sub(
            r"^(?:tab(?:let)?|cap(?:sule)?|syrup|inj(?:ection)?|"
            r"medicine|medication)\s*[:.-]?\s*",
            "",
            line,
            flags=re.I,
        )

        match = MEDICATION_PATTERN.search(cleaned)
        if not match:
            continue

        medications.append(
            {
                "name": match.group("name").strip(),
                "strength": (
                    match.group("strength").strip()
                    if match.group("strength")
                    else None
                ),
                "frequency": (
                    match.group("frequency").strip()
                    if match.group("frequency")
                    else None
                ),
                "source_text": line,
            }
        )

    return medications[:50]


def extract_lab_values(text: str) -> list[dict[str, Any]]:
    labs: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Only extract lines that look like clinical measurements.
        if not re.search(
            r"\b(hba1c|glucose|sugar|hemoglobin|hb|wbc|rbc|"
            r"platelet|cholesterol|creatinine|urea|tsh|"
            r"blood pressure|bp|temperature)\b",
            line,
            re.I,
        ):
            continue

        match = LAB_PATTERN.search(line)
        if match:
            labs.append(
                {
                    "test_name": match.group("name").strip(),
                    "value": match.group("value"),
                    "unit": match.group("unit").strip() or None,
                    "source_text": line,
                }
            )

    return labs[:100]


def extract_document_data(
    text: str,
    document_type: str,
) -> dict[str, Any]:
    """
    Deterministic first-pass clinical extraction.

    Important:
    - It extracts only information explicitly present in OCR text.
    - It does not diagnose.
    - It does not infer missing clinical facts.
    - It is intentionally conservative and LLM-ready for a later hybrid layer.
    """
    data: dict[str, Any] = {
        "document_type": document_type,
        "document_date": extract_document_date(text),
        "patient_name": _extract_labeled(
            text,
            ["Patient Name", "Patient", "Name"],
        ),
        "doctor_name": _extract_labeled(
            text,
            ["Doctor Name", "Doctor", "Consultant", "Physician"],
        ),
        "hospital_name": _extract_labeled(
            text,
            ["Hospital Name", "Hospital", "Clinic"],
        ),
        "diagnoses_mentioned": [],
        "allergies_mentioned": [],
        "medications": [],
        "lab_values": [],
        "source_note": (
            "Extracted from OCR text. "
            "Physician verification required."
        ),
    }

    # Only capture diagnoses when explicitly labeled in the source.
    diagnosis_text = _extract_labeled(
        text,
        ["Diagnosis", "Diagnoses", "Impression"],
    )
    if diagnosis_text:
        data["diagnoses_mentioned"] = [
            item.strip()
            for item in re.split(r"[,;|]", diagnosis_text)
            if item.strip()
        ][:30]

    allergy_text = _extract_labeled(text, ["Allergies", "Allergy", "Known Allergies"])
    if allergy_text:
        data["allergies_mentioned"] = [
            item.strip() for item in re.split(r"[,;|]", allergy_text) if item.strip()
        ][:20]

    data["medications"] = extract_medications(text)
    data["lab_values"] = extract_lab_values(text)

    return data


def count_fields(data: dict[str, Any]) -> int:
    """Number of clinically useful fields actually found in the source."""
    keys = ("diagnoses_mentioned", "medications", "lab_values", "allergies_mentioned", "document_date", "doctor_name")
    return sum(1 for key in keys if data.get(key))


def calculate_confidence(data: dict[str, Any]) -> float:
    """
    Conservative document-level confidence score.
    This is an extraction-quality indicator, NOT clinical certainty.
    """
    signals = 0
    if data.get("document_date"):
        signals += 1
    if data.get("patient_name"):
        signals += 1
    if data.get("doctor_name"):
        signals += 1
    if data.get("hospital_name"):
        signals += 1
    if data.get("diagnoses_mentioned"):
        signals += 1
    if data.get("medications"):
        signals += 1
    if data.get("lab_values"):
        signals += 1

    return round((signals / 7) * 100, 2)
