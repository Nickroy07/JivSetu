from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class AbhaLink(Base):
    """ABHA identifiers entered by staff for a patient.

    `verified` is only ever True after a real ABDM verification. The mock adapter never sets it.
    ABHA is separate from the JivSetu patient id and from card / QR tokens.
    """

    __tablename__ = "abha_links"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    patient_id = Column(BigIntId, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, unique=True)
    abha_number = Column(String(14), nullable=False)  # 14 digits, stored without separators
    abha_address = Column(String(100), nullable=True)
    verified = Column(Boolean, nullable=False, default=False)
    verification_source = Column(String(20), nullable=False, default="none")  # none | mock | abdm
    linked_by = Column(BigIntId, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
