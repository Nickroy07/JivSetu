from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db import Base, BigIntId


class OtpChallenge(Base):
    __tablename__ = "otp_challenges"

    id = Column(BigIntId, primary_key=True, autoincrement=True)
    mobile = Column(String(15), nullable=False, index=True)
    provider = Column(String(20), nullable=False)
    # HMAC of the code (dev provider only). MSG91 verifies codes itself.
    code_hash = Column(String(128), nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
