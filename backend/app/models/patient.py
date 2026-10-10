from sqlalchemy import Column, Date, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class Patient(Base):
    __tablename__ = "patients"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    user_id = Column(BigIntId, ForeignKey("users.id"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    mobile = Column(String(15), nullable=False, unique=True, index=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(30), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
