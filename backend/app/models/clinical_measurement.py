from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class ClinicalMeasurement(Base):
    """
    Longitudinal Patient Clinical Measurement Record.
    Stores verified and extracted biomarker values linked to patient, visit, and source report.
    """
    __tablename__ = "clinical_measurements"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(
        BigIntId,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    visit_id = Column(
        BigIntId,
        ForeignKey("patient_visits.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    document_id = Column(
        BigIntId,
        ForeignKey("medical_documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    test_code = Column(String(50), nullable=False, index=True)  # e.g. "hba1c", "fasting_glucose"
    test_name = Column(String(100), nullable=False)  # Display name e.g. "HbA1c"
    category = Column(String(50), nullable=False, default="general", index=True)  # diabetes, lipids, etc.

    value = Column(Float, nullable=False)
    unit = Column(String(30), nullable=False)
    test_date = Column(Date, nullable=False, index=True)

    reference_range_printed = Column(String(100), nullable=True)
    ref_low = Column(Float, nullable=True)
    ref_high = Column(Float, nullable=True)

    lab_name = Column(String(150), nullable=True)
    source_type = Column(String(30), nullable=False, default="document_ocr")  # document_ocr, patient_entry, doctor_entry
    source_page = Column(String(20), nullable=True)
    source_line = Column(String(255), nullable=True)

    verification_status = Column(String(30), nullable=False, default="extracted_unverified")
    # Statuses: "extracted_unverified", "clinician_verified", "patient_reported", "rejected"

    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    clinician_notes = Column(String(500), nullable=True)

    # Optional clinician-defined target range
    clinician_target_low = Column(Float, nullable=True)
    clinician_target_high = Column(Float, nullable=True)

    extra_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


Index("ix_measurement_patient_test_date", ClinicalMeasurement.patient_id, ClinicalMeasurement.test_code, ClinicalMeasurement.test_date)