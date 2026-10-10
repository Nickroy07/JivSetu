from sqlalchemy import JSON, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class AyushAssessment(Base):
    """One row per visit and module. Review state is cleared whenever the content changes afterwards."""

    __tablename__ = "ayush_assessments"
    __table_args__ = (UniqueConstraint("visit_id", "module", name="uq_ayush_visit_module"),)

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    visit_id = Column(BigIntId, ForeignKey("patient_visits.id", ondelete="CASCADE"), nullable=False, index=True)
    module = Column(String(20), nullable=False)  # trividha | ashtavidha | dashavidha
    data = Column(JSON, nullable=False)  # field key -> text
    sources = Column(JSON, nullable=False)  # field key -> "patient" | "practitioner"
    history = Column(JSON, nullable=False)  # [{at, role, actor, fields}] edit trail (no values)
    review_status = Column(String(20), nullable=False, default="unreviewed")  # unreviewed | reviewed
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
