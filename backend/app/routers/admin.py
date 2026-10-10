import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import audit
from app.config import settings
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.hospital import Hospital
from app.models.medical_document import MedicalDocument
from app.models.patient_visit import PatientVisit
from app.models.user import Doctor, User
from app.services import abdm as abdm_service
from app.services.ocr_service import available_engines
from app.security import hash_password, require_roles, staff_hospital_id

logger = logging.getLogger("jivsetu.admin")

_admin = require_roles("admin")
router = APIRouter(prefix="/admin", tags=["Administration"], dependencies=[Depends(_admin)])

STAFF_ROLE_CHOICES = ("doctor", "admin")
SUPPORTED_LANGUAGES = [
    {"code": "en", "label": "English"},
    {"code": "hi", "label": "हिन्दी"},
    {"code": "mr", "label": "मराठी"},
]


def _iso(v):
    return v.isoformat() if v else None


@router.get("/overview")
def overview(user=Depends(_admin), db: Session = Depends(get_db)):
    hid = staff_hospital_id(user)
    visits = db.query(func.count(PatientVisit.id)).filter(PatientVisit.hospital_id == hid).scalar() or 0
    patients = (
        db.query(func.count(func.distinct(PatientVisit.patient_id))).filter(PatientVisit.hospital_id == hid).scalar() or 0
    )
    staff = (
        db.query(func.count(User.id))
        .filter(User.hospital_id == hid, User.role.in_(STAFF_ROLE_CHOICES), User.is_active.is_(True))
        .scalar()
        or 0
    )
    doc_rows = (
        db.query(MedicalDocument.upload_status, func.count(MedicalDocument.id))
        .join(PatientVisit, PatientVisit.id == MedicalDocument.visit_id)
        .filter(PatientVisit.hospital_id == hid)
        .group_by(MedicalDocument.upload_status)
        .all()
    )
    docs = {s: int(c) for s, c in doc_rows}
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # reported in the response, never raised
        db_status = "unavailable"
    return {
        "counts": {
            "patients": int(patients),
            "visits": int(visits),
            "active_staff": int(staff),
            "documents": sum(docs.values()),
            "failed_documents": docs.get("failed", 0),
        },
        "documents_by_status": docs,
        "system": {
            "database": {"backend": settings.database_backend, "status": db_status},
            "otp_provider": settings.otp_provider,
            "ocr_engines": available_engines(),
            "environment": settings.environment,
            "demo_mode": settings.demo_mode,
        },
    }


def _user_row(u: User, d: Optional[Doctor]) -> dict:
    return {
        "id": int(u.id),
        "user_code": u.user_code,
        "role": u.role,
        "full_name": d.full_name if d else None,
        "is_active": bool(u.is_active),
        "created_at": _iso(u.created_at),
    }


@router.get("/users")
def list_users(
    search: Optional[str] = Query(None, max_length=100),
    role: Optional[str] = Query(None, pattern="^(doctor|admin)$"),
    user=Depends(_admin),
    db: Session = Depends(get_db),
):
    q = (
        db.query(User, Doctor)
        .outerjoin(Doctor, Doctor.user_id == User.id)
        .filter(User.hospital_id == staff_hospital_id(user), User.role.in_(STAFF_ROLE_CHOICES))
    )
    if role:
        q = q.filter(User.role == role)
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter((User.user_code.ilike(like)) | (Doctor.full_name.ilike(like)))
    return {"items": [_user_row(u, d) for u, d in q.order_by(User.id.desc()).limit(200).all()]}


class StaffCreate(BaseModel):
    user_code: str = Field(..., min_length=3, max_length=100, pattern=r"^[A-Za-z0-9._@-]+$")
    full_name: str = Field(..., min_length=2, max_length=255)
    role: str = Field(..., pattern="^(doctor|admin)$")
    password: str = Field(..., min_length=10, max_length=128)


@router.post("/users", status_code=201)
def create_user(payload: StaffCreate, user=Depends(_admin), db: Session = Depends(get_db)):
    hid = staff_hospital_id(user)
    if db.query(User).filter(User.user_code == payload.user_code).first():
        raise HTTPException(status_code=409, detail="That staff ID is already in use.")
    new = User(
        user_code=payload.user_code,
        password_hash=hash_password(payload.password),
        role=payload.role,
        hospital_id=hid,
        is_active=True,
    )
    db.add(new)
    try:
        db.flush()
        doctor = None
        if payload.role == "doctor":
            doctor = Doctor(user_id=new.id, full_name=payload.full_name.strip(), hospital_id=hid)
            db.add(doctor)
        audit.record(db, user, "admin.user_created", "user", new.id, f"role={payload.role}")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="That staff ID is already in use.")
    return {"success": True, "user": _user_row(new, doctor)}


class StaffUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = Field(default=None, pattern="^(doctor|admin)$")


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: StaffUpdate, user=Depends(_admin), db: Session = Depends(get_db)):
    target = db.get(User, user_id)
    if not target or target.hospital_id != staff_hospital_id(user) or target.role not in STAFF_ROLE_CHOICES:
        raise HTTPException(status_code=404, detail="User not found.")
    if int(target.id) == int(user["uid"]):
        raise HTTPException(status_code=409, detail="You cannot change your own role or active status.")
    changes = []
    if payload.is_active is not None and payload.is_active != target.is_active:
        target.is_active = payload.is_active
        changes.append(f"active={payload.is_active}")
    if payload.role and payload.role != target.role:
        target.role = payload.role
        changes.append(f"role={payload.role}")
    if changes:
        audit.record(db, user, "admin.user_updated", "user", target.id, ", ".join(changes))
        db.commit()
    doctor = db.query(Doctor).filter(Doctor.user_id == target.id).first()
    return {"success": True, "user": _user_row(target, doctor)}


class HospitalUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    name_hi: Optional[str] = Field(default=None, max_length=255)
    name_mr: Optional[str] = Field(default=None, max_length=255)


def _hospital(h: Hospital) -> dict:
    # hospital_code is the external-facing identifier; the numeric id stays internal.
    return {
        "hospital_code": h.hospital_code,
        "name": h.name,
        "name_hi": h.name_hi,
        "name_mr": h.name_mr,
        "is_active": bool(h.is_active),
    }


@router.get("/hospital")
def get_hospital(user=Depends(_admin), db: Session = Depends(get_db)):
    return _hospital(db.get(Hospital, staff_hospital_id(user)))


@router.patch("/hospital")
def update_hospital(payload: HospitalUpdate, user=Depends(_admin), db: Session = Depends(get_db)):
    h = db.get(Hospital, staff_hospital_id(user))
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        cleaned = value.strip() if isinstance(value, str) else value
        if key == "name" and not cleaned:
            continue
        setattr(h, key, cleaned or None)
    audit.record(db, user, "admin.hospital_updated", "hospital", h.id, ", ".join(sorted(data)))
    db.commit()
    return _hospital(h)


@router.get("/config")
def configuration(user=Depends(_admin)):
    """Read-only view of what is configured. Secret values are never returned."""
    return {
        "languages": SUPPORTED_LANGUAGES,
        "integrations": {
            "sms_otp": {"provider": settings.otp_provider, "configured": settings.otp_provider != "dev"},
            "ocr": {"engines": available_engines()},
            "abdm": abdm_service.status(),
        },
        "max_upload_mb": settings.max_upload_mb,
    }


@router.get("/audit")
def audit_log(
    action: Optional[str] = Query(None, max_length=80),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user=Depends(_admin),
    db: Session = Depends(get_db),
):
    """Read-only. There is deliberately no endpoint that edits or deletes audit rows."""
    q = db.query(AuditLog).filter(AuditLog.hospital_id == staff_hospital_id(user))
    if action:
        q = q.filter(AuditLog.action.like(f"{action}%"))
    total = q.count()
    rows = q.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "total": total,
        "page": page,
        "items": [
            {
                "id": int(a.id),
                "action": a.action,
                "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "details": a.details,
                "actor_user_id": a.actor_user_id,
                "created_at": _iso(a.created_at),
            }
            for a in rows
        ],
    }
