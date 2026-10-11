"""
Longitudinal Patient Health Monitoring and Clinical Progress Router.

Endpoints for:
- Patient Dashboard Overview with latest trends, categories, and source reports.
- Measurement History and Time-filtered trend analysis (1m, 3m, 6m, 12m, all).
- Clinician Review & Verification of extracted biomarkers.
- Report upload and structured extraction for longitudinal tracking.
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.clinical_measurement import ClinicalMeasurement
from app.models.medical_document import MedicalDocument
from app.models.patient import Patient
from app.models.user import User
from app.security import get_current_user, require_roles
from app.services.trend_analysis import (
    MEASUREMENT_REGISTRY,
    TrendResult,
    calculate_measurement_trend,
    resolve_canonical_test_code,
)

router = APIRouter(prefix="/health-monitoring", tags=["health-monitoring"])


# Pydantic Schemas
class MeasurementInput(BaseModel):
    test_code: str
    value: float
    unit: str
    test_date: date
    lab_name: Optional[str] = None
    source_type: str = "patient_entry"
    clinician_target_low: Optional[float] = None
    clinician_target_high: Optional[float] = None


class MeasurementVerifyInput(BaseModel):
    verified: bool = True
    corrected_value: Optional[float] = None
    corrected_unit: Optional[str] = None
    notes: Optional[str] = None
    clinician_target_low: Optional[float] = None
    clinician_target_high: Optional[float] = None


class MeasurementItemResponse(BaseModel):
    id: int
    patient_id: int
    visit_id: Optional[int]
    document_id: Optional[int]
    test_code: str
    test_name: str
    category: str
    value: float
    unit: str
    test_date: str
    ref_low: Optional[float]
    ref_high: Optional[float]
    reference_range_printed: Optional[str]
    lab_name: Optional[str]
    source_type: str
    source_line: Optional[str]
    verification_status: str
    verified_by: Optional[str]
    verified_at: Optional[str]
    clinician_notes: Optional[str]
    clinician_target_low: Optional[float]
    clinician_target_high: Optional[float]


class HealthOverviewCard(BaseModel):
    test_code: str
    canonical_name: str
    category: str
    unit: str
    current_value: float
    current_test_date: str
    previous_value: Optional[float]
    previous_test_date: Optional[str]
    absolute_change: Optional[float]
    percentage_change: Optional[float]
    is_percentage_metric: bool
    trend_direction: str
    patient_friendly_summary: str
    reference_low: Optional[float]
    reference_high: Optional[float]
    within_reference: Optional[bool]
    reference_status: str
    guideline_source: str
    verification_status: str
    document_id: Optional[int]
    total_records: int


class PatientDashboardResponse(BaseModel):
    patient_id: int
    patient_name: str
    mobile: Optional[str]
    active_conditions: List[str]
    overview_cards: List[HealthOverviewCard]
    total_reports_uploaded: int
    pending_verifications_count: int
    last_updated: str


@router.get("/patient/{patient_id}/dashboard", response_model=PatientDashboardResponse)
def get_patient_health_dashboard(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the comprehensive longitudinal patient health dashboard.
    Role check: Patient can view their own record; Doctor/Admin can view any authorized patient.
    """
    if current_user.get("role") == "patient" and current_user.get("patient_id") != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this patient dashboard.")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # All measurements for this patient
    records = (
        db.query(ClinicalMeasurement)
        .filter(ClinicalMeasurement.patient_id == patient_id)
        .order_by(ClinicalMeasurement.test_date.asc(), ClinicalMeasurement.id.asc())
        .all()
    )

    # Group by test_code
    grouped: Dict[str, List[ClinicalMeasurement]] = {}
    for r in records:
        grouped.setdefault(r.test_code, []).append(r)

    overview_cards: List[HealthOverviewCard] = []
    active_conditions = set()

    for test_code, items in grouped.items():
        dict_items = [
            {
                "value": item.value,
                "test_date": item.test_date.isoformat(),
            }
            for item in items
        ]

        latest_item = items[-1]
        trend = calculate_measurement_trend(
            test_code=test_code,
            measurements=dict_items,
            clinician_target_low=latest_item.clinician_target_low,
            clinician_target_high=latest_item.clinician_target_high,
        )

        active_conditions.add(trend.category)

        overview_cards.append(
            HealthOverviewCard(
                test_code=trend.test_code,
                canonical_name=trend.canonical_name,
                category=trend.category,
                unit=trend.unit,
                current_value=trend.current_value,
                current_test_date=trend.current_test_date,
                previous_value=trend.previous_value,
                previous_test_date=trend.previous_test_date,
                absolute_change=trend.absolute_change,
                percentage_change=trend.percentage_change,
                is_percentage_metric=trend.is_percentage_metric,
                trend_direction=trend.trend_direction,
                patient_friendly_summary=trend.patient_friendly_summary,
                reference_low=trend.reference_low,
                reference_high=trend.reference_high,
                within_reference=trend.within_reference,
                reference_status=trend.reference_status,
                guideline_source=trend.guideline_source,
                verification_status=latest_item.verification_status,
                document_id=latest_item.document_id,
                total_records=trend.total_data_points,
            )
        )

    # Count reports
    total_docs = db.query(MedicalDocument).filter(MedicalDocument.patient_id == patient_id).count()
    pending_verif = (
        db.query(ClinicalMeasurement)
        .filter(
            ClinicalMeasurement.patient_id == patient_id,
            ClinicalMeasurement.verification_status == "extracted_unverified",
        )
        .count()
    )

    return PatientDashboardResponse(
        patient_id=patient.id,
        patient_name=patient.full_name,
        mobile=patient.mobile,
        active_conditions=sorted(list(active_conditions)),
        overview_cards=overview_cards,
        total_reports_uploaded=total_docs,
        pending_verifications_count=pending_verif,
        last_updated=datetime.utcnow().isoformat() + "Z",
    )


@router.get("/patient/{patient_id}/timeline")
def get_patient_measurement_timeline(
    patient_id: int,
    test_code: Optional[str] = Query(None, description="Optional filter by test code (e.g. hba1c)"),
    months: Optional[int] = Query(None, description="1, 3, 6, 12 or None for all"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Returns time-filtered series of measurements for interactive trend charting.
    """
    if current_user.get("role") == "patient" and current_user.get("patient_id") != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    q = db.query(ClinicalMeasurement).filter(ClinicalMeasurement.patient_id == patient_id)

    if test_code:
        q = q.filter(ClinicalMeasurement.test_code == test_code)

    if months and months > 0:
        start_date = date.today() - timedelta(days=months * 30)
        q = q.filter(ClinicalMeasurement.test_date >= start_date)

    items = q.order_by(ClinicalMeasurement.test_date.asc()).all()

    return {
        "patient_id": patient_id,
        "test_code": test_code,
        "timeframe_months": months,
        "count": len(items),
        "items": [
            {
                "id": m.id,
                "test_code": m.test_code,
                "test_name": m.test_name,
                "value": m.value,
                "unit": m.unit,
                "test_date": m.test_date.isoformat(),
                "ref_low": m.ref_low,
                "ref_high": m.ref_high,
                "verification_status": m.verification_status,
                "verified_by": m.verified_by,
                "source_line": m.source_line,
                "document_id": m.document_id,
            }
            for m in items
        ],
    }


@router.post("/patient/{patient_id}/measurements")
def add_patient_measurement(
    patient_id: int,
    payload: MeasurementInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Manually add a health measurement (patient-reported or doctor-entered)."""
    if current_user.get("role") == "patient" and current_user.get("patient_id") != patient_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    mdef = MEASUREMENT_REGISTRY.get(payload.test_code)
    test_name = mdef.canonical_name if mdef else payload.test_code.replace("_", " ").title()
    category = mdef.category if mdef else "general"

    verification_status = "clinician_verified" if current_user.get("role") in ("doctor", "admin") else "patient_reported"

    meas = ClinicalMeasurement(
        patient_id=patient_id,
        test_code=payload.test_code,
        test_name=test_name,
        category=category,
        value=payload.value,
        unit=payload.unit,
        test_date=payload.test_date,
        ref_low=mdef.default_ref_low if mdef else None,
        ref_high=mdef.default_ref_high if mdef else None,
        reference_range_printed=mdef.ref_source if mdef else None,
        lab_name=payload.lab_name,
        source_type=payload.source_type,
        verification_status=verification_status,
        verified_by=current_user.get("sub") if current_user.get("role") in ("doctor", "admin") else None,
        verified_at=datetime.utcnow() if current_user.get("role") in ("doctor", "admin") else None,
        clinician_target_low=payload.clinician_target_low,
        clinician_target_high=payload.clinician_target_high,
    )
    db.add(meas)
    db.commit()
    db.refresh(meas)

    return {"success": True, "measurement_id": meas.id}


@router.patch("/measurements/{measurement_id}/verify", dependencies=[Depends(require_roles("doctor", "admin"))])
def verify_measurement(
    measurement_id: int,
    payload: MeasurementVerifyInput,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Clinician verification and optional correction of an extracted biomarker value."""
    meas = db.query(ClinicalMeasurement).filter(ClinicalMeasurement.id == measurement_id).first()
    if not meas:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Measurement not found.")

    if payload.corrected_value is not None:
        meas.value = payload.corrected_value
    if payload.corrected_unit is not None:
        meas.unit = payload.corrected_unit
    if payload.notes is not None:
        meas.clinician_notes = payload.notes
    if payload.clinician_target_low is not None:
        meas.clinician_target_low = payload.clinician_target_low
    if payload.clinician_target_high is not None:
        meas.clinician_target_high = payload.clinician_target_high

    meas.verification_status = "clinician_verified" if payload.verified else "rejected"
    meas.verified_by = current_user.get("sub")
    meas.verified_at = datetime.utcnow()

    db.commit()
    return {"success": True, "measurement_id": meas.id, "status": meas.verification_status}