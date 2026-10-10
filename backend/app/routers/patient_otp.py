import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import audit
from app.config import settings
from app.db import get_db
from app.ratelimit import rate_limit
from app.models.consent import CONSENT_PURPOSES, Consent
from app.models.hospital import Hospital
from app.models.otp_challenge import OtpChallenge
from app.models.patient import Patient
from app.models.patient_visit import PatientVisit
from app.models.user import User
from app.security import create_access_token, require_roles
from app.services import otp_service

logger = logging.getLogger("jivsetu.patient")

router = APIRouter(prefix="/auth/patient", tags=["Patient OTP"])
patient_router = APIRouter(prefix="/patient", tags=["Patient"])


class SendOTPRequest(BaseModel):
    mobile: str = Field(min_length=10, max_length=14)


class VerifyOTPRequest(BaseModel):
    mobile: str = Field(min_length=10, max_length=14)
    otp: str = Field(pattern=r"^\d{4,6}$")
    name: str = Field(min_length=2, max_length=120)


def normalize_mobile(mobile: str) -> str:
    mobile = mobile.strip().replace(" ", "").replace("-", "")
    if mobile.startswith("+91"):
        mobile = mobile[3:]
    elif mobile.startswith("91") and len(mobile) == 12:
        mobile = mobile[2:]
    if len(mobile) != 10 or not mobile.isdigit() or mobile[0] not in "6789":
        raise HTTPException(status_code=422, detail="Enter a valid 10-digit Indian mobile number.")
    return mobile


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _default_hospital(db: Session) -> Hospital:
    hospital = db.query(Hospital).filter(Hospital.hospital_code == settings.default_hospital_code).first()
    if not hospital:
        logger.error("default hospital %s missing; run init_db.py", settings.default_hospital_code)
        raise HTTPException(status_code=503, detail="Hospital is not configured. Please contact staff.")
    return hospital


@router.post("/send-otp")
def send_patient_otp(request: SendOTPRequest, db: Session = Depends(get_db)):
    mobile = normalize_mobile(request.mobile)
    window_start = _now() - timedelta(minutes=15)
    recent = (
        db.query(OtpChallenge)
        .filter(OtpChallenge.mobile == mobile, OtpChallenge.created_at >= window_start)
        .count()
    )
    if recent >= settings.otp_max_sends_per_window:
        raise HTTPException(status_code=429, detail="Too many code requests. Please wait 15 minutes and try again.")

    provider = settings.otp_provider
    expires_at = _now() + timedelta(minutes=settings.otp_expire_minutes)

    if provider == "msg91":
        if not otp_service.msg91_configured():
            raise HTTPException(status_code=503, detail="SMS delivery is not configured. Please ask hospital staff for help.")
        try:
            otp_service.msg91_send(mobile)
        except otp_service.OtpProviderError:
            logger.warning("OTP delivery failed via msg91")
            raise HTTPException(status_code=502, detail="We could not send the SMS. Please try again shortly.")
        db.add(OtpChallenge(mobile=mobile, provider="msg91", expires_at=expires_at))
        db.commit()
        return {"success": True, "delivery": "sms", "message": "A verification code was sent by SMS.", "mobile": mobile}

    if provider != "dev" or settings.is_production:
        raise HTTPException(status_code=503, detail="SMS delivery is not configured. Please ask hospital staff for help.")

    code = otp_service.generate_code()
    db.add(OtpChallenge(mobile=mobile, provider="dev", code_hash=otp_service.hash_code(mobile, code), expires_at=expires_at))
    db.commit()
    return {
        "success": True,
        "delivery": "development",
        "message": "Development mode: no SMS was sent. Use the code shown on screen.",
        "mobile": mobile,
        "dev_otp": code,
        "expires_in": settings.otp_expire_minutes * 60,
    }


@router.post("/resend-otp")
def resend_patient_otp(request: SendOTPRequest, db: Session = Depends(get_db)):
    return send_patient_otp(request, db)


@router.post("/verify-otp", dependencies=[Depends(rate_limit(10, 300))])
def verify_patient_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    mobile = normalize_mobile(request.mobile)
    name = " ".join(request.name.split())

    challenge = (
        db.query(OtpChallenge)
        .filter(OtpChallenge.mobile == mobile, OtpChallenge.consumed_at.is_(None))
        .order_by(OtpChallenge.id.desc())
        .first()
    )
    if not challenge or challenge.expires_at < _now():
        raise HTTPException(status_code=400, detail="This code has expired. Please request a new code.")
    if challenge.attempts >= settings.otp_max_attempts:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")

    challenge.attempts += 1
    if challenge.provider == "msg91":
        try:
            valid = otp_service.msg91_verify(mobile, request.otp)
        except otp_service.OtpProviderError:
            db.commit()
            raise HTTPException(status_code=502, detail="We could not verify the code right now. Please try again.")
    else:
        valid = otp_service.codes_match(mobile, request.otp, challenge.code_hash)

    if not valid:
        db.commit()
        remaining = max(0, settings.otp_max_attempts - challenge.attempts)
        raise HTTPException(status_code=400, detail=f"Incorrect code. {remaining} attempt(s) remaining.")

    challenge.consumed_at = _now()
    hospital = _default_hospital(db)

    user_code = f"patient-{mobile}"
    user = db.query(User).filter(User.user_code == user_code).first()
    if not user:
        user = User(user_code=user_code, password_hash=None, role="patient", hospital_id=hospital.id, is_active=True)
        db.add(user)
        db.flush()

    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if patient:
        patient.full_name = name
    else:
        patient = Patient(user_id=user.id, full_name=name, mobile=mobile)
        db.add(patient)
        db.flush()

    # Reuse today's open visit so repeated sign-ins do not flood the queue.
    visit = (
        db.query(PatientVisit)
        .filter(
            PatientVisit.patient_id == patient.id,
            PatientVisit.visit_date == date.today(),
            PatientVisit.status != "completed",
        )
        .order_by(PatientVisit.id.desc())
        .first()
    )
    if not visit:
        visit = PatientVisit(patient_id=patient.id, hospital_id=hospital.id, visit_date=date.today(), status="waiting")
        db.add(visit)
        db.flush()

    actor = {"uid": int(user.id), "role": "patient", "hospital_id": hospital.id}
    audit.record(db, actor, "patient.verified", "visit", visit.id)
    db.commit()

    token = create_access_token(
        user_code=user.user_code,
        uid=int(user.id),
        role="patient",
        hospital_id=int(hospital.id),
        patient_id=int(patient.id),
        expires_minutes=settings.patient_token_expire_minutes,
    )
    return {
        "success": True,
        "message": "Mobile number verified.",
        "access_token": token,
        "token_type": "bearer",
        "mobile": mobile,
        "patient_id": int(patient.id),
        "visit_id": int(visit.id),
        "visit_status": visit.status,
    }


# =========================================================
# Patient self-service
# =========================================================


def _own_visit(db: Session, user: dict, visit_id: int) -> PatientVisit:
    visit = db.query(PatientVisit).filter(PatientVisit.id == visit_id).first()
    if not visit or int(visit.patient_id) != int(user.get("patient_id") or 0):
        raise HTTPException(status_code=404, detail="Visit not found.")
    return visit


@patient_router.get("/me")
def patient_me(user=Depends(require_roles("patient")), db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == user["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found.")
    visit = (
        db.query(PatientVisit)
        .filter(PatientVisit.patient_id == patient.id)
        .order_by(PatientVisit.id.desc())
        .first()
    )
    return {
        "patient": {"id": int(patient.id), "full_name": patient.full_name},
        "visit": (
            {"id": int(visit.id), "status": visit.status, "visit_date": visit.visit_date.isoformat()}
            if visit
            else None
        ),
    }


@patient_router.post("/visits/{visit_id}/start-interview")
def start_interview(visit_id: int, user=Depends(require_roles("patient")), db: Session = Depends(get_db)):
    visit = _own_visit(db, user, visit_id)
    if not _has_consent(db, int(visit.patient_id), "case_taking"):
        raise HTTPException(status_code=409, detail="Consent is required before the interview can start.")
    if visit.status == "waiting":
        visit.status = "in_interview"
        db.commit()
    return {"success": True, "visit_id": int(visit.id), "status": visit.status}


CONSENT_TEXT_VERSION = "1.0"


class ConsentRequest(BaseModel):
    visit_id: int
    purposes: dict[str, bool] = Field(..., description="purpose -> granted")
    language: str | None = Field(default=None, pattern="^(en|hi|mr)$")


def _has_consent(db: Session, patient_id: int, purpose: str) -> bool:
    """Latest ledger entry for the purpose decides; withdrawal is a newer granted=False row."""
    latest = (
        db.query(Consent)
        .filter(Consent.patient_id == patient_id, Consent.purpose == purpose)
        .order_by(Consent.id.desc())
        .first()
    )
    return bool(latest and latest.granted)


@patient_router.post("/consent", status_code=201)
def record_consent(payload: ConsentRequest, user=Depends(require_roles("patient")), db: Session = Depends(get_db)):
    visit = _own_visit(db, user, payload.visit_id)
    unknown = set(payload.purposes) - set(CONSENT_PURPOSES)
    if unknown:
        raise HTTPException(status_code=422, detail="Unknown consent purpose.")
    for purpose, granted in payload.purposes.items():
        db.add(
            Consent(
                patient_id=visit.patient_id,
                visit_id=visit.id,
                purpose=purpose,
                granted=bool(granted),
                text_version=CONSENT_TEXT_VERSION,
                language=payload.language,
            )
        )
    audit.record(db, user, "consent.recorded", "visit", visit.id)
    db.commit()
    return {"success": True, "consents": {p: _has_consent(db, int(visit.patient_id), p) for p in CONSENT_PURPOSES}}


@patient_router.get("/consent")
def get_consent(user=Depends(require_roles("patient")), db: Session = Depends(get_db)):
    pid = int(user["patient_id"])
    return {"consents": {p: _has_consent(db, pid, p) for p in CONSENT_PURPOSES}, "text_version": CONSENT_TEXT_VERSION}
