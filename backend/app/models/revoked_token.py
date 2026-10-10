from sqlalchemy import Column, DateTime, String
from sqlalchemy.sql import func

from app.db import Base


class RevokedToken(Base):
    """JWT IDs invalidated by logout. Rows past `expires_at` are safe to purge."""

    __tablename__ = "revoked_tokens"

    jti = Column(String(64), primary_key=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, server_default=func.now(), nullable=False)
