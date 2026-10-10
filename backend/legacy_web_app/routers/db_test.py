from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/database", tags=["Database"])


@router.get("/test")
def database_test(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT DATABASE()")).scalar_one()

    return {
        "status": "connected",
        "database": result,
    }
