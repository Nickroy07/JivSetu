from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class ClinicalDocumentExtraction(Base):
    __tablename__ = "clinical_document_extractions"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    document_id = Column(
        BigIntId,
        ForeignKey("medical_documents.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # completed = at least one structured field was found; failed = none.
    extraction_status = Column(String(20), nullable=False, default="completed")
    # Machine extraction exactly as produced from the source text.
    extracted_data = Column(JSON, nullable=False)
    # Share of expected fields that were found (0-100). A coverage
    # heuristic, NOT a probability of correctness.
    confidence = Column(Numeric(5, 2), nullable=False, default=0)
    fields_found = Column(Integer, nullable=False, default=0)
    # Clinician corrections; never overwrites extracted_data.
    reviewed_data = Column(JSON, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
