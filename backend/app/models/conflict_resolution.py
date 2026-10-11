from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db import Base, BigIntId

CONFLICT_DECISIONS = ("patient_correct", "document_correct", "needs_follow_up")


class ConflictResolution(Base):
    """
    Clinician decision on a conflict between patient answers and documents.

    Append-only: the latest row per (visit_id, field) is the current decision, older rows
    stay as history. Never edits the patient's answers or the extracted document data.
    """

    __tablename__ = "conflict_resolutions"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    visit_id = Column(BigIntId, ForeignKey("patient_visits.id", ondelete="CASCADE"), nullable=False, index=True)
    field = Column(String(64), nullable=False)
    decision = Column(String(30), nullable=False)
    reason = Column(Text, nullable=False)
    resolved_by = Column(String(100), nullable=False)
    resolved_at = Column(DateTime, server_default=func.now(), nullable=False)
