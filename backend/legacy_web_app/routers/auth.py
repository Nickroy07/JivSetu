from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import LoginResponse
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            SELECT id, user_code, role, hospital_id, password_hash, is_active
            FROM users
            WHERE user_code = :user_code
            LIMIT 1
            """
        ),
        {"user_code": form_data.username},
    ).mappings().first()

    if not row or not row["is_active"] or not row["password_hash"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        user_id=str(row["id"]),
        role=row["role"],
        hospital_id=str(row["hospital_id"]) if row["hospital_id"] else None,
    )

    return LoginResponse(
        access_token=token,
        role=row["role"],
        user_id=row["user_code"],
    )
