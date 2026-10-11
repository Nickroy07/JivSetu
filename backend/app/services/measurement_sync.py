from datetime import date, datetime
import logging
from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.models.clinical_measurement import ClinicalMeasurement
from app.models.medical_document import MedicalDocument
from app.services.trend_analysis import MEASUREMENT_REGISTRY, resolve_canonical_test_code

logger = logging.getLogger("jivsetu.measurements")


def sync_measurements_from_extraction(
    db: Session,
    document: MedicalDocument,
    extracted_data: Dict[str, Any]
) -> List[ClinicalMeasurement]:
    """
    Synchronizes structured lab measurements into the ClinicalMeasurement table
    with source line reference, document link, and canonical test code mapping.
    """
    labs = extracted_data.get("labs") or []
    if not isinstance(labs, list) or not labs:
        return []

    # Parse test date from document extraction or fallback to document creation date
    doc_date_str = extracted_data.get("document_date")
    test_dt: date = date.today()
    if doc_date_str:
        try:
            test_dt = datetime.fromisoformat(str(doc_date_str).split("T")[0]).date()
        except Exception:
            test_dt = document.created_at.date() if document.created_at else date.today()
    elif document.created_at:
        test_dt = document.created_at.date()

    created_measurements: List[ClinicalMeasurement] = []

    for lab in labs:
        raw_name = lab.get("test_name") or lab.get("name")
        raw_val = lab.get("value")
        raw_unit = lab.get("unit") or ""
        source_text = lab.get("source_text") or ""

        if not raw_name or raw_val is None:
            continue

        try:
            val_float = float(raw_val)
        except (ValueError, TypeError):
            continue

        test_code = resolve_canonical_test_code(raw_name)
        if not test_code:
            # Fallback canonical code
            test_code = "_".join(str(raw_name).strip().lower().split())

        mdef = MEASUREMENT_REGISTRY.get(test_code)
        canonical_name = mdef.canonical_name if mdef else raw_name.title()
        category = mdef.category if mdef else "general"
        unit = raw_unit if raw_unit else (mdef.primary_unit if mdef else "")
        ref_low = mdef.default_ref_low if mdef else None
        ref_high = mdef.default_ref_high if mdef else None
        ref_printed = lab.get("reference_range") or (mdef.ref_source if mdef else None)

        # Avoid exact duplicate for the same document and test_code
        existing = db.query(ClinicalMeasurement).filter_by(
            document_id=document.id,
            test_code=test_code
        ).first()

        if existing:
            existing.value = val_float
            existing.unit = unit
            existing.test_date = test_dt
            existing.source_line = source_text[:255] if source_text else None
            created_measurements.append(existing)
        else:
            meas = ClinicalMeasurement(
                patient_id=document.patient_id,
                visit_id=document.visit_id,
                document_id=document.id,
                test_code=test_code,
                test_name=canonical_name,
                category=category,
                value=val_float,
                unit=unit,
                test_date=test_dt,
                reference_range_printed=ref_printed,
                ref_low=ref_low,
                ref_high=ref_high,
                source_type="document_ocr",
                source_line=source_text[:255] if source_text else None,
                verification_status="extracted_unverified"
            )
            db.add(meas)
            created_measurements.append(meas)

    if created_measurements:
        db.commit()
        logger.info("Synchronized %d clinical measurements for document %s", len(created_measurements), document.id)

    return created_measurements