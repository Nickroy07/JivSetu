from sqlalchemy import Column, Date, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId

VISIT_STATUSES = (
    "waiting",
    "in_interview",
    "documents_uploaded",
    "ready_for_review",
    "completed",
)


class PatientVisit(Base):
    __tablename__ = "patient_visits"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    hospital_id = Column(BigIntId, ForeignKey("hospitals.id"), nullable=False, index=True)
    visit_date = Column(Date, nullable=False, index=True)
    status = Column(String(30), nullable=False, default="waiting", index=True)
    chief_complaint = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
