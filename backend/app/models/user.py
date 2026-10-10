from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class User(Base):
    __tablename__ = "users"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    user_code = Column(String(100), nullable=False, unique=True)
    # NULL for patients (they authenticate with OTP); Argon2 hash otherwise.
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, index=True)  # patient | doctor | admin
    hospital_id = Column(BigIntId, ForeignKey("hospitals.id"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    user_id = Column(BigIntId, ForeignKey("users.id"), nullable=False, unique=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True, unique=True)
    hospital_id = Column(BigIntId, ForeignKey("hospitals.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
