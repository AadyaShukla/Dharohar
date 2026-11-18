"""Audit logging system recording all agent interactions, approvals, and simulated transactions."""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.database import AuditLogRow, SessionLocal


def log_event(
    booking_id: Optional[str] = None,
    actor: str = "SYSTEM",
    action: str = "EVENT",
    details: Optional[Dict[str, Any]] = None,
    db: Optional[Session] = None,
) -> AuditLogRow:
    """Log an audit event with actor, action, and JSON details.

    Supported actors: ORGANIZER_AGENT, ARTIST_AGENT, RULES_ENGINE, ARTIST, ORGANIZER, SYSTEM
    Supported actions: OFFER_PROPOSED, OFFER_REJECTED, OFFER_ACCEPTED, STANDBY_CHECKED,
                       ARTIST_APPROVED, ARTIST_DECLINED, ORGANIZER_APPROVED_CHANGE
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        log_entry = AuditLogRow(
            booking_id=booking_id,
            actor=actor,
            action=action,
            details=details or {},
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    finally:
        if should_close:
            db.close()


def get_audit_log(
    booking_id: str,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Retrieve chronological audit logs for a given booking ID."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        logs = (
            db.query(AuditLogRow)
            .filter(AuditLogRow.booking_id == booking_id)
            .order_by(AuditLogRow.timestamp.asc(), AuditLogRow.id.asc())
            .all()
        )
        return [entry.to_dict() for entry in logs]
    finally:
        if should_close:
            db.close()
