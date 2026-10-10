from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True)
    visit_id = Column(BigIntId, ForeignKey("patient_visits.id", ondelete="SET NULL"), nullable=True, index=True)
    document_type = Column(String(50), nullable=False)
    # Shown to clinicians only; never used to build a filesystem path.
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=True, index=True)

    # uploaded -> processing -> processed | failed
    upload_status = Column(String(20), nullable=False, default="uploaded")
    # pending -> processing -> completed | failed
    ocr_status = Column(String(20), nullable=False, default="pending")
    ocr_text = Column(Text, nullable=True)
    extraction_method = Column(String(30), nullable=True)  # pdf_text | paddleocr | tesseract
    processing_error = Column(String(500), nullable=True)
    processing_attempts = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
