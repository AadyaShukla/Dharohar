"""Signed, single-use, expiring action tokens for artist approvals."""

from __future__ import annotations

from datetime import datetime, timedelta
import hashlib
import secrets
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database import SingleUseActionTokenRow


def create_action_token(
    booking_id: str,
    artist_id: str,
    action: str,
    db: Session,
    expiry_hours: Optional[int] = None,
) -> Tuple[str, str]:
    """Generate and persist a secure single-use expiring token.

    Returns:
        (token_string, action_url)
    """
    settings = get_settings()
    exp_hours = expiry_hours or getattr(settings, "ACTION_TOKEN_EXPIRY_HOURS", 24)

    # Cryptographically secure random token string
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expires_at = datetime.utcnow() + timedelta(hours=exp_hours)

    token_row = SingleUseActionTokenRow(
        id=raw_token,
        token_hash=token_hash,
        booking_id=booking_id,
        artist_id=artist_id,
        action=action.upper(),
        expires_at=expires_at,
        consumed=False,
        consumed_at=None,
    )
    db.add(token_row)
    db.commit()
    db.refresh(token_row)

    base_url = settings.PUBLIC_BASE_URL or "http://localhost:8000"
    action_url = f"{base_url.rstrip('/')}/api/actions/verify?token={raw_token}"

    return raw_token, action_url


def verify_and_consume_token(
    token_str: str,
    db: Session,
) -> SingleUseActionTokenRow:
    """Validate token, ensure not expired and not consumed, and atomically consume it.

    Raises ValueError if invalid, expired, or already consumed.
    """
    if not token_str or not token_str.strip():
        raise ValueError("Invalid action token: token is empty.")

    token_clean = token_str.strip()
    token_hash = hashlib.sha256(token_clean.encode("utf-8")).hexdigest()

    token_row = (
        db.query(SingleUseActionTokenRow)
        .filter(
            (SingleUseActionTokenRow.id == token_clean)
            | (SingleUseActionTokenRow.token_hash == token_hash)
        )
        .first()
    )

    if not token_row:
        raise ValueError("Invalid action token: token not found.")

    now = datetime.utcnow()
    if now > token_row.expires_at:
        raise ValueError(f"Action token expired at {token_row.expires_at.isoformat()}.")

    if token_row.consumed:
        raise ValueError(
            f"Action token has already been used on {token_row.consumed_at.isoformat() if token_row.consumed_at else 'prior request'}."
        )

    # Atomically mark consumed
    token_row.consumed = True
    token_row.consumed_at = now
    db.commit()
    db.refresh(token_row)

    return token_row
