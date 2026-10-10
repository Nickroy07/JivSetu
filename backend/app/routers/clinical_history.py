from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.clinical_history import PHYSICIAN_STATUSES, ClinicalHistory
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.routers.documents import load_documents, serialize_document
from app.security import ensure_patient_access, get_current_user, is_staff, require_staff
from app.services.case_summary import build_case_summary

router = APIRouter(prefix="/clinical-history", tags=["Clinical History"])

MAX_ANSWER_CHARS = 2000


class ClinicalHistoryCreate(BaseModel):
    patient_id: int = Field(gt=0)
    visit_id: int = Field(gt=0)
    chief_complaint: Optional[str] = Field(None, max_length=255)
    history_data: dict[str, Any] = Field(default_factory=dict)
    red_flags: list[Any] = Field(default_factory=list, max_length=50)

    @field_validator("history_data")
    @classmethod
    def _validate_answers(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 100:
            raise ValueError("Too many answers.")
        cleaned = {}
        for key, answer in value.items():
            if not isinstance(key, str) or len(key) > 64:
                raise ValueError("Invalid question id.")
            if isinstance(answer, str):
                answer = answer.strip()[:MAX_ANSWER_CHARS]
            elif not isinstance(answer, (int, float, bool)) and answer is not None:
                raise ValueError("Answers must be text, numbers or yes/no.")
            if answer not in (None, ""):
                cleaned[key] = answer
        return cleaned


class PhysicianReview(BaseModel):
    physician_status: Optional[str] = None
    physician_notes: Optional[str] = Field(None, max_length=10000)
    doctor_edits: Optional[dict[str, Any]] = None
    # Optimistic concurrency: ISO timestamp the client last saw.
    expected_updated_at: Optional[str] = None


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def history_dict(history: ClinicalHistory) -> dict[str, Any]:
    return {
        "id": int(history.id),
        "visit_id": int(history.visit_id),
        "patient_id": int(history.patient_id),
        "chief_complaint": history.chief_complaint,
        "history_data": history.history_data or {},
        "red_flags": history.red_flags or [],
        "doctor_edits": history.doctor_edits or {},
        "completion_status": history.completion_status,
        "physician_status": history.physician_status,
        "physician_notes": history.physician_notes,
        "reviewed_by": history.reviewed_by,
        "reviewed_at": _iso(history.reviewed_at),
        "created_at": _iso(history.created_at),
        "updated_at": _iso(history.updated_at),
    }


def _visit_for(db: Session, visit_id: int, user: dict) -> PatientVisit:
    visit = db.get(PatientVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    ensure_patient_access(user, int(visit.patient_id))
    return visit


@router.post("")
def save_clinical_history(payload: ClinicalHistoryCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_patient_access(user, payload.patient_id)
    visit = db.get(PatientVisit, payload.visit_id)
    if not visit or int(visit.patient_id) != payload.patient_id:
        raise HTTPException(status_code=404, detail="Visit not found.")
    if not payload.history_data:
        raise HTTPException(status_code=422, detail="Your answers are empty. Please complete the interview before submitting.")

    history = db.query(ClinicalHistory).filter(ClinicalHistory.visit_id == payload.visit_id).first()
    if history and history.physician_status in ("accepted", "amended") and not is_staff(user):
        raise HTTPException(status_code=409, detail="This visit has already been reviewed by your doctor.")
    if history is None:
        history = ClinicalHistory(visit_id=payload.visit_id, patient_id=payload.patient_id)
        db.add(history)

    documents = [serialize_document(d, e, include_text=False) for d, e in load_documents(db, payload.patient_id)]
    history.chief_complaint = payload.chief_complaint
    history.history_data = dict(payload.history_data)
    history.red_flags = list(payload.red_flags)
    history.ai_summary = build_case_summary(history.history_data, history.red_flags, documents)
    history.completion_status = "completed"
    history.physician_status = "pending"

    visit.chief_complaint = payload.chief_complaint
    visit.status = "ready_for_review"

    db.flush()
    audit.record(db, user, "history.submitted", "visit", visit.id, f"answers={len(history.history_data)}")
    db.commit()
    db.refresh(history)

    return {
        "success": True,
        "message": "Your answers were saved and sent for doctor review.",
        "clinical_history_id": int(history.id),
        "clinical_history": history_dict(history),
        "missing_information": history.ai_summary["missing_information"],
    }


@router.get("/visits/{visit_id}")
def get_clinical_history(visit_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _visit_for(db, visit_id, user)
    history = db.query(ClinicalHistory).filter(ClinicalHistory.visit_id == visit_id).first()
    return {"success": True, "clinical_history": history_dict(history) if history else None}


@router.get("/visits/{visit_id}/complete")
def get_complete_case(visit_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Full case: patient answers, live draft summary, documents and review status."""
    visit = _visit_for(db, visit_id, user)
    patient = db.get(Patient, visit.patient_id)
    history = db.query(ClinicalHistory).filter(ClinicalHistory.visit_id == visit_id).first()
    staff = is_staff(user)
    documents = [serialize_document(d, e, include_text=staff) for d, e in load_documents(db, int(visit.patient_id))]

    history_data = (history.history_data or {}) if history else {}
    red_flags = (history.red_flags or []) if history else []
    # Recomputed so that newly processed documents are reflected.
    summary = build_case_summary(history_data, red_flags, documents) if history else None

    return {
        "success": True,
        "patient": {
            "id": int(visit.patient_id),
            "full_name": patient.full_name if patient else None,
            "mobile": patient.mobile if (patient and staff) else None,
        },
        "visit": {
            "id": int(visit.id),
            "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
            "status": visit.status,
            "chief_complaint": visit.chief_complaint,
            "updated_at": _iso(visit.updated_at),
        },
        "clinical_history": history_dict(history) if history else None,
        "draft_summary": summary,
        "documents": documents,
        "stats": {
            "documents_total": len(documents),
            "documents_processed": sum(1 for d in documents if d["upload_status"] == "processed"),
            "documents_failed": sum(1 for d in documents if d["upload_status"] == "failed"),
            "documents_processing": sum(1 for d in documents if d["processing"]),
            "red_flags_total": len(red_flags),
            "interview_answers_total": len(history_data),
            "missing_total": len(summary["missing_information"]) if summary else 0,
            "conflicts_total": len(summary["conflicts"]) if summary else 0,
        },
    }


@router.patch("/visits/{visit_id}/review")
def review_case(visit_id: int, payload: PhysicianReview, user=Depends(require_staff), db: Session = Depends(get_db)):
    """Save clinician edits/notes (draft) and optionally record a decision."""
    visit = _visit_for(db, visit_id, user)
    history = db.query(ClinicalHistory).filter(ClinicalHistory.visit_id == visit_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="No clinical history has been submitted for this visit.")

    if payload.expected_updated_at and _iso(history.updated_at) and payload.expected_updated_at != _iso(history.updated_at):
        raise HTTPException(status_code=409, detail="This case was changed by someone else. Reload to see the latest version; your edits are kept on screen.")

    if payload.physician_status is not None:
        if payload.physician_status not in PHYSICIAN_STATUSES:
            raise HTTPException(status_code=422, detail=f"physician_status must be one of: {', '.join(PHYSICIAN_STATUSES)}")
        if payload.physician_status == "rejected" and not (payload.physician_notes or history.physician_notes):
            raise HTTPException(status_code=422, detail="Add a note explaining why the history was rejected.")
        history.physician_status = payload.physician_status
        visit.status = "completed" if payload.physician_status in ("accepted", "amended") else "ready_for_review"

    if payload.physician_notes is not None:
        history.physician_notes = payload.physician_notes.strip() or None
    if payload.doctor_edits is not None:
        history.doctor_edits = {k: v for k, v in payload.doctor_edits.items() if isinstance(k, str) and len(k) <= 64}

    history.reviewed_by = user["sub"]
    history.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    history.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    audit.record(db, user, f"history.review.{payload.physician_status or 'draft'}", "visit", visit.id)
    db.commit()
    db.refresh(history)
    return {"success": True, "message": "Review saved.", "clinical_history": history_dict(history), "visit_status": visit.status}


# Backwards-compatible endpoint used by earlier frontends.
@router.patch("/visits/{visit_id}/physician-decision")
def physician_decision(visit_id: int, payload: PhysicianReview, user=Depends(require_staff), db: Session = Depends(get_db)):
    return review_case(visit_id, payload, user, db)
