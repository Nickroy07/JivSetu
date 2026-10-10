import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash

from app.config import settings
from app.db import SessionLocal

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

STAFF_ROLES = ("doctor", "admin")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    try:
        return password_hash.verify(password, hashed_password)
    except Exception:  # malformed hash
        return False


def create_access_token(
    *,
    user_code: str,
    uid: int,
    role: str,
    hospital_id: int | None = None,
    patient_id: int | None = None,
    expires_minutes: int | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_code,
        "uid": uid,
        "role": role,
        "hospital_id": hospital_id,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes or settings.access_token_expire_minutes),
    }
    if patient_id is not None:
        payload["patient_id"] = patient_id
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _unauthorized(detail: str = "Authentication required.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _session_is_valid(payload: dict[str, Any]) -> bool:
    """Server-side checks a signed token alone cannot give: logout revocation and deactivation."""
    from app.models.revoked_token import RevokedToken
    from app.models.user import User

    with SessionLocal() as db:
        jti = payload.get("jti")
        if jti and db.get(RevokedToken, jti):
            return False
        user = db.get(User, int(payload["uid"]))
        return bool(user and user.is_active)


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict[str, Any]:
    if not token:
        raise _unauthorized()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError:
        raise _unauthorized("Your session has expired. Please sign in again.")
    if not payload.get("sub") or not payload.get("role") or payload.get("uid") is None:
        raise _unauthorized("Invalid authentication token.")
    if not _session_is_valid(payload):
        raise _unauthorized("Your session has ended. Please sign in again.")
    return payload


def require_roles(*allowed_roles: str):
    def dependency(current_user: dict[str, Any] = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(status_code=403, detail="You do not have permission for this operation.")
        return current_user

    return dependency


require_staff = require_roles(*STAFF_ROLES)


def is_staff(user: dict[str, Any]) -> bool:
    return user.get("role") in STAFF_ROLES


def staff_hospital_id(user: dict[str, Any]) -> int:
    """Hospital a staff member is assigned to; staff without one cannot read patient records."""
    hospital_id = user.get("hospital_id")
    if hospital_id is None:
        raise HTTPException(status_code=403, detail="Your account is not assigned to a hospital.")
    return int(hospital_id)


def ensure_patient_access(user: dict[str, Any], patient_id: int) -> None:
    """A patient may access only their own record; staff only patients with a visit at their hospital."""
    if user.get("role") == "patient" and int(user.get("patient_id") or 0) == int(patient_id):
        return
    if is_staff(user) and user.get("hospital_id") is not None:
        from app.models.patient_visit import PatientVisit

        with SessionLocal() as db:
            seen = (
                db.query(PatientVisit.id)
                .filter(PatientVisit.patient_id == int(patient_id), PatientVisit.hospital_id == int(user["hospital_id"]))
                .first()
            )
        if seen:
            return
    # 404 rather than 403 so record existence is not disclosed.
    raise HTTPException(status_code=404, detail="Record not found.")
