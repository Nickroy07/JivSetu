# backend/app/services/ocr_confidence.py

import re
from typing import Any


def clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    """Keep the score between 0 and 100."""
    return max(minimum, min(value, maximum))


def calculate_ocr_confidence(
    extracted_text: str,
    ocr_word_scores: list[float] | None = None,
    required_fields: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Calculate a heuristic OCR confidence score.

    Parameters:
        extracted_text:
            Text extracted from the uploaded document.

        ocr_word_scores:
            OCR engine confidence values in the range 0.0–1.0
            or 0–100.

        required_fields:
            Expected fields and their extracted values.
            Example:
            {
                "patient_name": "Rahul",
                "date": "12/09/2026",
                "diagnosis": "Diabetes"
            }
    """

    extracted_text = extracted_text.strip() if extracted_text else ""

    # 1. OCR engine confidence
    if ocr_word_scores:
        normalized_scores = [
            score * 100 if 0 <= score <= 1 else score
            for score in ocr_word_scores
        ]

        valid_scores = [
            clamp(float(score))
            for score in normalized_scores
            if score is not None
        ]

        ocr_score = (
            sum(valid_scores) / len(valid_scores)
            if valid_scores
            else 0.0
        )
    else:
        # No engine-level confidence was provided.
        ocr_score = 0.0

    # 2. Text quality score
    text_quality_score = calculate_text_quality(extracted_text)

    # 3. Required-field completeness score
    completeness_score = calculate_completeness(required_fields)

    # Weighted heuristic formula
    final_score = (
        0.40 * ocr_score
        + 0.30 * text_quality_score
        + 0.30 * completeness_score
    )

    final_score = round(clamp(final_score), 2)

    if final_score >= 85:
        confidence_level = "high"
        verification_required = False
    elif final_score >= 60:
        confidence_level = "medium"
        verification_required = True
    else:
        confidence_level = "low"
        verification_required = True

    return {
        "confidence_score": final_score,
        "confidence_level": confidence_level,
        "verification_required": verification_required,
        "components": {
            "ocr_engine_score": round(ocr_score, 2),
            "text_quality_score": round(text_quality_score, 2),
            "completeness_score": round(completeness_score, 2),
        },
    }


def calculate_text_quality(text: str) -> float:
    """Estimate whether the extracted text looks usable."""

    if not text:
        return 0.0

    characters = len(text)
    alphanumeric_characters = sum(
        character.isalnum() for character in text
    )

    alphanumeric_ratio = alphanumeric_characters / characters

    # Basic heuristic: more meaningful characters indicate better quality.
    score = alphanumeric_ratio * 100

    # Penalize extremely short OCR output.
    if characters < 10:
        score *= 0.5

    return clamp(score)


def calculate_completeness(
    required_fields: dict[str, Any] | None,
) -> float:
    """Calculate the percentage of non-empty extracted fields."""

    if not required_fields:
        return 0.0

    total_fields = len(required_fields)

    completed_fields = sum(
        1
        for value in required_fields.values()
        if value is not None and str(value).strip() != ""
    )

    return (completed_fields / total_fields) * 100