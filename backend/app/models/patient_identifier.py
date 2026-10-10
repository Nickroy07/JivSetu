from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId

IDENTIFIER_KINDS = ("qr", "rfid", "nfc")


class PatientIdentifier(Base):
    """A card / QR token linked to a patient. Holds a random token hash only: no clinical or personal data."""

    __tablename__ = "patient_identifiers"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(10), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True)  # sha256 of the random token
    is_active = Column(Boolean, nullable=False, default=True)
    issued_by = Column(BigIntId, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    deactivated_at = Column(DateTime, nullable=True)
