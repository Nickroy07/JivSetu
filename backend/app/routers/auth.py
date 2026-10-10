import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import audit
from app.config import settings
from app.db import get_db
from app.models.user import Doctor, User
from app.ratelimit import rate_limit
from app.schemas import LoginResponse
from app.security import STAFF_ROLES, create_access_token, get_current_user, verify_password

logger = logging.getLogger("jivsetu.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])

_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid staff ID or password.",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/login", response_model=LoginResponse, dependencies=[Depends(rate_limit(10, 300))])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Staff (doctor / admin) login. `username` is the staff ID."""
    user_code = (form_data.username or "").strip()
    user = db.query(User).filter(User.user_code == user_code).first()

    if not user or user.role not in STAFF_ROLES or not user.is_active:
        # Equalise timing with a dummy verification.
        verify_password(form_data.password, None)
        logger.info("login rejected (unknown or inactive account)")
        raise _INVALID

    if not verify_password(form_data.password, user.password_hash):
        logger.info("login rejected (bad password) uid=%s", user.id)
        raise _INVALID

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    claims = {"uid": int(user.id), "role": user.role, "hospital_id": user.hospital_id}
    token = create_access_token(user_code=user.user_code, **claims)

    audit.record(db, claims, "auth.login", "user", user.id)
    db.commit()

    return LoginResponse(
        access_token=token,
        role=user.role,
        user_id=user.user_code,
        display_name=doctor.full_name if doctor else user.user_code,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "user_id": current_user["sub"],
        "role": current_user["role"],
        "patient_id": current_user.get("patient_id"),
    }
