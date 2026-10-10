from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db import Base, BigIntId

PHYSICIAN_STATUSES = ("pending", "accepted", "amended", "rejected")


class ClinicalHistory(Base):
    __tablename__ = "clinical_histories"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    visit_id = Column(BigIntId, ForeignKey("patient_visits.id", ondelete="CASCADE"), nullable=False, unique=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    chief_complaint = Column(String(255), nullable=True)

    # Patient-reported answers, keyed by question id. Never modified by staff.
    history_data = Column(JSON, nullable=False)
    red_flags = Column(JSON, nullable=True)
    # Machine-generated draft (sections, missing info, conflicts).
    ai_summary = Column(JSON, nullable=True)
    # Clinician corrections / confirmed values, keyed by field.
    doctor_edits = Column(JSON, nullable=True)

    completion_status = Column(String(30), nullable=False, default="completed")
    physician_status = Column(String(30), nullable=False, default="pending")
    physician_notes = Column(Text, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
