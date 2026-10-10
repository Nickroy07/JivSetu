from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    actor_user_id = Column(BigIntId, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    hospital_id = Column(BigIntId, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(80), nullable=False)
    resource_type = Column(String(80), nullable=False)
    resource_id = Column(String(128), nullable=False)
    # Short, non-PHI description (no names, mobile numbers or answers).
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
