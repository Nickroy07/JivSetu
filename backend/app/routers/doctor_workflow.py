from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.clinical_history import ClinicalHistory
from app.models.medical_document import MedicalDocument
from app.models.patient import Patient
from app.models.patient_visit import VISIT_STATUSES, PatientVisit
from app.security import require_staff

router = APIRouter(prefix="/doctor", tags=["Doctor Workflow"], dependencies=[Depends(require_staff)])

OPEN_STATUSES = ("waiting", "in_interview", "documents_uploaded", "ready_for_review")

ACTIVITY_LABELS = {
    "patient.verified": "Patient checked in",
    "history.submitted": "Interview submitted",
    "document.uploaded": "Document uploaded",
    "extraction.reviewed": "Document extraction reviewed",
    "history.review.draft": "Review draft saved",
    "history.review.accepted": "History accepted",
    "history.review.amended": "History accepted with amendments",
    "history.review.rejected": "History returned",
    "history.review.pending": "Review reopened",
}


def _iso(value):
    return value.isoformat() if value else None


def _doc_counts(db: Session, patient_ids: list[int]) -> dict[int, dict[str, int]]:
    if not patient_ids:
        return {}
    rows = (
        db.query(
            MedicalDocument.patient_id,
            func.count(MedicalDocument.id),
            func.sum(case((MedicalDocument.upload_status == "failed", 1), else_=0)),
            func.sum(case((MedicalDocument.upload_status.in_(("uploaded", "processing")), 1), else_=0)),
        )
        .filter(MedicalDocument.patient_id.in_(patient_ids))
        .group_by(MedicalDocument.patient_id)
        .all()
    )
    return {int(pid): {"total": int(t or 0), "failed": int(f or 0), "processing": int(p or 0)} for pid, t, f, p in rows}


def _case_row(visit: PatientVisit, patient: Patient, history: Optional[ClinicalHistory], docs: dict[str, int]) -> dict:
    return {
        "visit_id": int(visit.id),
        "patient_id": int(patient.id),
        "full_name": patient.full_name,
        "mobile_last4": (patient.mobile or "")[-4:],
        "status": visit.status,
        "chief_complaint": visit.chief_complaint,
        "visit_date": _iso(visit.visit_date),
        "updated_at": _iso(visit.updated_at),
        "physician_status": history.physician_status if history else None,
        "red_flags": len(history.red_flags or []) if history else 0,
        "documents": docs.get("total", 0),
        "documents_failed": docs.get("failed", 0),
        "documents_processing": docs.get("processing", 0),
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    status_rows = db.query(PatientVisit.status, func.count(PatientVisit.id)).group_by(PatientVisit.status).all()
    by_status = {s: 0 for s in VISIT_STATUSES} | {s: int(c) for s, c in status_rows}

    today_total = db.query(func.count(PatientVisit.id)).filter(PatientVisit.visit_date == date.today()).scalar() or 0
    awaiting_review = (
        db.query(func.count(ClinicalHistory.id))
        .join(PatientVisit, PatientVisit.id == ClinicalHistory.visit_id)
        .filter(ClinicalHistory.physician_status == "pending", PatientVisit.status == "ready_for_review")
        .scalar()
        or 0
    )

    failed_docs = (
        db.query(MedicalDocument, Patient)
        .join(Patient, Patient.id == MedicalDocument.patient_id)
        .filter(MedicalDocument.upload_status == "failed")
        .order_by(MedicalDocument.updated_at.desc())
        .limit(5)
        .all()
    )
    failed_total = db.query(func.count(MedicalDocument.id)).filter(MedicalDocument.upload_status == "failed").scalar() or 0

    recent = (
        db.query(PatientVisit, Patient, ClinicalHistory)
        .join(Patient, Patient.id == PatientVisit.patient_id)
        .outerjoin(ClinicalHistory, ClinicalHistory.visit_id == PatientVisit.id)
        .order_by(PatientVisit.updated_at.desc(), PatientVisit.id.desc())
        .limit(6)
        .all()
    )
    docs = _doc_counts(db, [int(p.id) for _, p, _ in recent])

    activity = db.query(AuditLog).filter(AuditLog.action != "auth.login").order_by(AuditLog.id.desc()).limit(10).all()

    return {
        "counts": {
            "in_queue": sum(by_status[s] for s in OPEN_STATUSES),
            "today": int(today_total),
            "awaiting_review": int(awaiting_review),
            "completed": by_status["completed"],
            "failed_documents": int(failed_total),
            "by_status": by_status,
        },
        "recent_cases": [_case_row(v, p, h, docs.get(int(p.id), {})) for v, p, h in recent],
        "processing_failures": [
            {
                "document_id": int(d.id),
                "patient_id": int(p.id),
                "full_name": p.full_name,
                "visit_id": int(d.visit_id) if d.visit_id else None,
                "document_type": d.document_type,
                "error": d.processing_error,
                "updated_at": _iso(d.updated_at),
            }
            for d, p in failed_docs
        ],
        "activity": [
            {
                "id": int(a.id),
                "action": a.action,
                "label": ACTIVITY_LABELS.get(a.action, a.action),
                "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "details": a.details,
                "created_at": _iso(a.created_at),
            }
            for a in activity
        ],
    }


SORTS = {
    "updated_desc": (PatientVisit.updated_at.desc(), PatientVisit.id.desc()),
    "updated_asc": (PatientVisit.updated_at.asc(), PatientVisit.id.asc()),
    "date_desc": (PatientVisit.visit_date.desc(), PatientVisit.id.desc()),
    "name_asc": (Patient.full_name.asc(), PatientVisit.id.desc()),
}


@router.get("/queue")
def get_doctor_queue(
    scope: str = Query("all", pattern="^(all|today|open)$"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    sort: str = Query("updated_desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if status and status not in VISIT_STATUSES:
        raise HTTPException(status_code=422, detail="Unknown status filter.")
    if sort not in SORTS:
        raise HTTPException(status_code=422, detail="Unknown sort order.")

    query = (
        db.query(PatientVisit, Patient, ClinicalHistory)
        .join(Patient, Patient.id == PatientVisit.patient_id)
        .outerjoin(ClinicalHistory, ClinicalHistory.visit_id == PatientVisit.id)
    )
    if scope == "today":
        query = query.filter(PatientVisit.visit_date == date.today())
    elif scope == "open":
        query = query.filter(PatientVisit.status.in_(OPEN_STATUSES))
    if status:
        query = query.filter(PatientVisit.status == status)

    term = (search or "").strip()
    if term:
        like = f"%{term}%"
        conditions = [Patient.full_name.ilike(like), Patient.mobile.like(like), PatientVisit.chief_complaint.ilike(like)]
        if term.isdigit():
            conditions += [Patient.id == int(term), PatientVisit.id == int(term)]
        query = query.filter(or_(*conditions))

    total = query.count()
    rows = query.order_by(*SORTS[sort]).offset((page - 1) * page_size).limit(page_size).all()
    docs = _doc_counts(db, [int(p.id) for _, p, _ in rows])

    return {
        "success": True,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "items": [_case_row(v, p, h, docs.get(int(p.id), {})) for v, p, h in rows],
    }


@router.get("/patients/{patient_id}")
def get_doctor_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    visits = (
        db.query(PatientVisit, ClinicalHistory)
        .outerjoin(ClinicalHistory, ClinicalHistory.visit_id == PatientVisit.id)
        .filter(PatientVisit.patient_id == patient_id)
        .order_by(PatientVisit.visit_date.desc(), PatientVisit.id.desc())
        .all()
    )
    return {
        "success": True,
        "patient": {"id": int(patient.id), "full_name": patient.full_name, "mobile": patient.mobile},
        "visits": [
            {
                "id": int(v.id),
                "visit_date": _iso(v.visit_date),
                "status": v.status,
                "chief_complaint": v.chief_complaint,
                "physician_status": h.physician_status if h else None,
            }
            for v, h in visits
        ],
    }
