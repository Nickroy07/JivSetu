import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.ayush_assessment import AyushAssessment
from app.models.patient_visit import PatientVisit
from app.security import ensure_patient_access, get_current_user, is_staff
from app.services import ayush as defs

logger = logging.getLogger("jivsetu.ayush")

router = APIRouter(prefix="/ayush", tags=["AYUSH assessment"])


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(v):
    return v.isoformat() if v else None


def _visit_for(db: Session, visit_id: int, user: dict) -> PatientVisit:
    visit = db.get(PatientVisit, visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found.")
    ensure_patient_access(user, int(visit.patient_id))
    if is_staff(user) and visit.hospital_id != user.get("hospital_id"):
        raise HTTPException(status_code=404, detail="Visit not found.")
    return visit


def _module(name: str) -> dict[str, Any]:
    if name not in defs.MODULES:
        raise HTTPException(status_code=404, detail="Unknown assessment module.")
    return defs.MODULES[name]


def _view(module: str, row: AyushAssessment | None, role: str) -> dict[str, Any]:
    data = dict(row.data) if row else {}
    sources = dict(row.sources) if row else {}
    patient_view = role == "patient"
    allowed = set(defs.field_keys(module, "patient" if patient_view else None))
    return {
        "module": module,
        "values": {k: v for k, v in data.items() if k in allowed},
        "sources": {k: v for k, v in sources.items() if k in allowed},
        # Patients only see completeness of the part they can answer.
        "status": defs.completion_status(module, data, "patient" if patient_view else None),
        "review_status": "unreviewed" if patient_view and not row else (row.review_status if row else "unreviewed"),
        "reviewed_by": None if patient_view else (row.reviewed_by if row else None),
        "reviewed_at": None if patient_view else _iso(row.reviewed_at if row else None),
        "updated_at": _iso(row.updated_at) if row else None,
    }


@router.get("/schema")
def schema(user=Depends(get_current_user)):
    return {"languages": list(defs.LANGS), "modules": defs.schema_for(user["role"]), "scoring": "none (no validated scoring is implemented)"}


@router.get("/visits/{visit_id}")
def get_assessments(visit_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    visit = _visit_for(db, visit_id, user)
    rows = {r.module: r for r in db.query(AyushAssessment).filter(AyushAssessment.visit_id == visit.id).all()}
    return {"visit_id": int(visit.id), "modules": [_view(m, rows.get(m), user["role"]) for m in defs.MODULES]}


class AssessmentUpdate(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)
    verify: bool = False


@router.put("/visits/{visit_id}/{module}")
def save_assessment(visit_id: int, module: str, payload: AssessmentUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _module(module)
    visit = _visit_for(db, visit_id, user)
    role = user["role"]
    valid = set(defs.field_keys(module))
    if set(payload.values) - valid:
        raise HTTPException(status_code=422, detail="Unknown assessment field.")
    if role == "patient":
        if set(payload.values) - set(defs.field_keys(module, "patient")):
            raise HTTPException(status_code=403, detail="These fields can only be completed by your practitioner.")
        if payload.verify:
            raise HTTPException(status_code=403, detail="Only a doctor can verify an assessment.")
    if payload.verify and role != "doctor":
        raise HTTPException(status_code=403, detail="Only a doctor can verify an assessment.")
    for value in payload.values.values():
        if len(value) > defs.MAX_VALUE_LENGTH:
            raise HTTPException(status_code=422, detail=f"Answers must be {defs.MAX_VALUE_LENGTH} characters or fewer.")

    row = db.query(AyushAssessment).filter(AyushAssessment.visit_id == visit.id, AyushAssessment.module == module).first()
    if not row:
        row = AyushAssessment(patient_id=visit.patient_id, visit_id=visit.id, module=module, data={}, sources={}, history=[], review_status="unreviewed")
        db.add(row)

    data, sources = dict(row.data), dict(row.sources)
    changed = []
    for key, raw in payload.values.items():
        value = raw.strip()
        if (data.get(key) or "") == value:
            continue
        if value:
            data[key], sources[key] = value, "patient" if role == "patient" else "practitioner"
        else:
            data.pop(key, None)
            sources.pop(key, None)
        changed.append(key)

    if changed:
        row.data, row.sources = data, sources
        row.history = [*row.history, {"at": _now().isoformat(), "role": role, "actor": user["sub"], "fields": changed}][-100:]
        if row.review_status == "reviewed":  # content changed after review -> needs review again
            row.review_status, row.reviewed_by, row.reviewed_at = "unreviewed", None, None

    if payload.verify:
        if defs.completion_status(module, data) != "completed":
            db.rollback()
            raise HTTPException(status_code=409, detail="Complete every field before verifying this assessment.")
        row.review_status, row.reviewed_by, row.reviewed_at = "reviewed", user["sub"], _now()

    if changed or payload.verify:
        audit.record(db, user, "ayush.verified" if payload.verify else "ayush.updated", "visit", visit.id, f"module={module} fields={','.join(changed)}")
    db.commit()
    db.refresh(row)
    return {"success": True, "assessment": _view(module, row, role)}
