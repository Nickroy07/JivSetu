from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId

CONSENT_PURPOSES = ("case_taking", "document_processing", "clinician_access", "voice_input")


class Consent(Base):
    """Append-only consent ledger: a withdrawal is a new row with granted=False."""

    __tablename__ = "consents"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    visit_id = Column(BigIntId, ForeignKey("patient_visits.id"), nullable=True, index=True)
    purpose = Column(String(40), nullable=False)
    granted = Column(Boolean, nullable=False)
    text_version = Column(String(20), nullable=False)
    language = Column(String(5), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
