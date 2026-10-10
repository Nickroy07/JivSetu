"""QR / RFID / NFC patient identification.

A scanned token only *identifies* a patient. It never grants access: the patient must still
verify with an OTP sent to their registered mobile number before a session is issued.
Tokens are random, stored hashed, carry no personal or clinical data, and can be revoked.
"""
import hashlib
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import audit
from app.db import get_db
from app.models.patient import Patient
from app.models.patient_identifier import IDENTIFIER_KINDS, PatientIdentifier
from app.ratelimit import rate_limit
from app.routers.patient_otp import SendOTPRequest, VerifyOTPRequest, send_patient_otp, verify_patient_otp
from app.security import ensure_patient_access, require_staff

logger = logging.getLogger("jivsetu.identifiers")

router = APIRouter(prefix="/identifiers", tags=["Patient identification"])

PREFIX = "JSV1."  # self-describing QR / card payload prefix
_NOT_RECOGNISED = HTTPException(status_code=404, detail="This card or code was not recognised. Please use your mobile number instead.")


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash(raw: str) -> str:
    token = raw.strip()
    if token.startswith(PREFIX):
        token = token[len(PREFIX):]
    return hashlib.sha256(token.encode()).hexdigest()


def _lookup(db: Session, raw: str) -> tuple[PatientIdentifier, Patient]:
    ident = db.query(PatientIdentifier).filter(PatientIdentifier.token_hash == _hash(raw), PatientIdentifier.is_active.is_(True)).first()
    patient = db.get(Patient, ident.patient_id) if ident else None
    if not ident or not patient:
        raise _NOT_RECOGNISED
    return ident, patient


def _row(i: PatientIdentifier) -> dict:
    return {
        "id": int(i.id),
        "kind": i.kind,
        "is_active": bool(i.is_active),
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "last_used_at": i.last_used_at.isoformat() if i.last_used_at else None,
    }


class IssueRequest(BaseModel):
    patient_id: int
    kind: str = Field(pattern="^(qr|rfid|nfc)$")


@router.post("", status_code=201)
def issue_identifier(payload: IssueRequest, user=Depends(require_staff), db: Session = Depends(get_db)):
    """Staff issue a token for a patient of their hospital. The token is shown once and cannot be retrieved later."""
    assert payload.kind in IDENTIFIER_KINDS
    ensure_patient_access(user, payload.patient_id)
    raw = secrets.token_urlsafe(24)
    ident = PatientIdentifier(patient_id=payload.patient_id, kind=payload.kind, token_hash=_hash(raw), issued_by=user["uid"])
    db.add(ident)
    db.flush()
    audit.record(db, user, "identifier.issued", "patient", payload.patient_id, f"kind={payload.kind}")
    db.commit()
    return {**_row(ident), "payload": PREFIX + raw, "note": "Write this payload to the card or print it as a QR code. It is shown only once."}


@router.get("/patient/{patient_id}")
def list_identifiers(patient_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    ensure_patient_access(user, patient_id)
    rows = db.query(PatientIdentifier).filter(PatientIdentifier.patient_id == patient_id).order_by(PatientIdentifier.id.desc()).all()
    return {"items": [_row(r) for r in rows]}


@router.delete("/{identifier_id}", status_code=204)
def deactivate_identifier(identifier_id: int, user=Depends(require_staff), db: Session = Depends(get_db)):
    ident = db.get(PatientIdentifier, identifier_id)
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found.")
    ensure_patient_access(user, int(ident.patient_id))
    if ident.is_active:
        ident.is_active, ident.deactivated_at = False, _now()
        audit.record(db, user, "identifier.deactivated", "patient", ident.patient_id)
        db.commit()


class ScanRequest(BaseModel):
    token: str = Field(min_length=8, max_length=200)


class ScanVerify(ScanRequest):
    otp: str = Field(pattern=r"^\d{4,6}$")


@router.post("/scan", dependencies=[Depends(rate_limit(10, 300))])
def scan(payload: ScanRequest, db: Session = Depends(get_db)):
    """Identify from a scanned token and send an OTP to the registered mobile. Returns no patient data."""
    ident, patient = _lookup(db, payload.token)
    sent = send_patient_otp(SendOTPRequest(mobile=patient.mobile), db)
    sent = {k: v for k, v in sent.items() if k != "mobile"}
    return {**sent, "masked_mobile": "******" + patient.mobile[-2:], "next": "verify"}


@router.post("/verify", dependencies=[Depends(rate_limit(10, 300))])
def verify(payload: ScanVerify, db: Session = Depends(get_db)):
    """Complete card sign-in with the OTP. Issues the same patient session as normal OTP sign-in."""
    ident, patient = _lookup(db, payload.token)
    result = verify_patient_otp(VerifyOTPRequest(mobile=patient.mobile, otp=payload.otp, name=patient.full_name), db)
    ident.last_used_at = _now()
    db.commit()
    return {**result, "name": patient.full_name}
