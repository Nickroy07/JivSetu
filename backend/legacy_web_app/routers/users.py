from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.security import require_roles

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/count")
def user_count(
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    count = db.execute(text("SELECT COUNT(*) FROM users")).scalar_one()

    return {
        "user_count": count,
        "requested_by": current_user["sub"],
    }
