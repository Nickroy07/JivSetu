import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger("jivsetu.audit")


def record(
    db: Session,
    actor: dict[str, Any] | None,
    action: str,
    resource_type: str,
    resource_id: Any,
    details: str | None = None,
) -> None:
    """
    Add an audit entry to the current transaction (caller commits).
    `details` must not contain PHI such as names, mobile numbers or answers.
    """
    db.add(
        AuditLog(
            actor_user_id=(actor or {}).get("uid"),
            hospital_id=(actor or {}).get("hospital_id"),
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            details=details,
        )
    )
    logger.info("audit action=%s resource=%s:%s role=%s", action, resource_type, resource_id, (actor or {}).get("role"))
