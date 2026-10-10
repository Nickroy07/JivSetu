from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    hospital_code = Column(String(50), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    name_hi = Column(String(255), nullable=True)
    name_mr = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
