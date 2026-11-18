"""SQLAlchemy models and database session setup for Dharohar."""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
import json

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from backend.config import get_settings

DB_FILE = Path(__file__).resolve().parent / "dharohar.db"


def get_engine():
    """Create or return SQLAlchemy engine configured from settings."""
    settings = get_settings()
    db_url = settings.DATABASE_URL

    if settings.ENV.strip().lower() == "production" and db_url.startswith("sqlite"):
        raise ValueError(
            "Production environment requires a PostgreSQL database (DATABASE_URL cannot be SQLite)."
        )

    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    return create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )


engine = get_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# -----------------------------------------------------------------------------
# Database Models
# -----------------------------------------------------------------------------

class UserRow(Base):
    """Database table storing simulated users with roles (ORGANIZER | ARTIST | OPERATOR)."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    role = Column(String, nullable=False, index=True)  # ORGANIZER | ARTIST | OPERATOR | COORDINATOR
    language = Column(String, nullable=False, default="hi")
    email = Column(String, nullable=True)
    notification_preference = Column(String, nullable=False, default="whatsapp")  # whatsapp | email | in_app
    opted_out = Column(Boolean, nullable=False, default=False, index=True)
    artist_id = Column(String, ForeignKey("artists.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "phone": self.phone,
            "role": self.role,
            "language": self.language,
            "email": self.email,
            "notification_preference": self.notification_preference,
            "opted_out": self.opted_out,
            "artist_id": self.artist_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ConsentRow(Base):
    """Database table storing user legal consents (terms and privacy policy)."""

    __tablename__ = "consents"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    terms_version = Column(String, nullable=False, default="1.0")
    privacy_version = Column(String, nullable=False, default="1.0")
    consented_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "terms_version": self.terms_version,
            "privacy_version": self.privacy_version,
            "consented_at": self.consented_at.isoformat() if self.consented_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TokenBlacklistRow(Base):
    """Database table storing revoked JWT session tokens."""

    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "token": self.token[:16] + "...",
            "user_id": self.user_id,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "revoked_at": self.revoked_at.isoformat() if self.revoked_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OtpRow(Base):
    """Database table storing temporary phone-OTP verification hashes."""

    __tablename__ = "otps"

    phone = Column(String, primary_key=True, index=True)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "phone": self.phone,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "attempts": self.attempts,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ArtistRow(Base):
    """Database table storing folk artist profiles, verification stages, and constraints."""

    __tablename__ = "artists"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    art_form = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False, index=True)
    state = Column(String, nullable=False, default="Rajasthan")
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=False, default=1)
    group_size = Column(Integer, nullable=False, default=1)
    equipment_needed = Column(Text, nullable=True)

    # Stored as integer PAISE (e.g. 14,000 INR = 1,400,000 paise)
    min_fee = Column(Integer, nullable=False, default=1000000)
    travel_range_km = Column(Integer, nullable=False, default=100)
    min_duration_minutes = Column(Integer, nullable=False, default=60)
    max_group_size = Column(Integer, nullable=False, default=10)

    # Availability calendar
    blackout_dates = Column(JSON, nullable=False, default=list)  # ISO string list ["YYYY-MM-DD"]
    recurring_unavailable_days = Column(JSON, nullable=False, default=list)  # e.g. ["Monday", "Friday"]

    # Media & Live Challenge
    photo_urls = Column(JSON, nullable=False, default=list)
    video_urls = Column(JSON, nullable=False, default=list)
    live_prompt_phrase = Column(String, nullable=True)

    # Financial & Payout (encrypted at rest)
    upi_id = Column(String, nullable=True)
    linked_account_id = Column(String, nullable=True)  # Razorpay Route linked account (acc_xxx)
    payout_account_status = Column(String, nullable=False, default="PENDING_VERIFICATION")

    # Verification & Listing Lifecycle
    # verification_stage: REGISTERED | COORDINATOR_VOUCHED | VIDEO_REVIEWED | TRUSTED
    verification_stage = Column(String, nullable=False, default="REGISTERED", index=True)
    # listing_status: DRAFT | PENDING_REVIEW | LIVE | SUSPENDED
    listing_status = Column(String, nullable=False, default="DRAFT", index=True)

    # Reliability, Ratings & Performance Metrics
    rating = Column(Float, nullable=False, default=5.0)
    ratings_count = Column(Integer, nullable=False, default=0)
    ratings_sum = Column(Float, nullable=False, default=0.0)
    reliability_score = Column(Float, nullable=False, default=100.0)
    completed_bookings_count = Column(Integer, nullable=False, default=0)
    no_shows_count = Column(Integer, nullable=False, default=0)
    late_cancels_count = Column(Integer, nullable=False, default=0)

    languages = Column(JSON, nullable=False, default=list)  # list of strings
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, show_sensitive: bool = False) -> Dict[str, Any]:
        """Convert row to serializable dictionary with clear API boundary conversion."""
        from backend.crypto import decrypt_sensitive, mask_upi_id
        decrypted_upi = decrypt_sensitive(self.upi_id) if self.upi_id else ""
        return {
            "id": self.id,
            "name": self.name,
            "art_form": self.art_form,
            "city": self.city,
            "state": self.state,
            "bio": self.bio or "",
            "years_experience": self.years_experience,
            "group_size": self.group_size,
            "equipment_needed": self.equipment_needed or "",
            "min_fee": self.min_fee // 100,  # Converted to INR at API boundary
            "min_fee_paise": self.min_fee,
            "travel_range_km": self.travel_range_km,
            "min_duration_minutes": self.min_duration_minutes,
            "max_group_size": self.max_group_size,
            "blackout_dates": self.blackout_dates or [],
            "recurring_unavailable_days": self.recurring_unavailable_days or [],
            "photo_urls": self.photo_urls or [],
            "video_urls": self.video_urls or [],
            "live_prompt_phrase": self.live_prompt_phrase,
            "upi_id": decrypted_upi if show_sensitive else mask_upi_id(decrypted_upi),
            "masked_upi_id": mask_upi_id(decrypted_upi),
            "has_upi": bool(self.upi_id),
            "linked_account_id": self.linked_account_id,
            "payout_account_status": self.payout_account_status,
            "verification_stage": self.verification_stage,
            "listing_status": self.listing_status,
            "rating": self.rating,
            "ratings_count": self.ratings_count,
            "reliability_score": self.reliability_score,
            "completed_bookings_count": self.completed_bookings_count,
            "no_shows_count": self.no_shows_count,
            "late_cancels_count": self.late_cancels_count,
            "languages": self.languages or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class CoordinatorVouchRow(Base):
    """Database table storing independent coordinator vouches for folk artists."""

    __tablename__ = "coordinator_vouches"

    id = Column(String, primary_key=True, index=True)
    artist_id = Column(String, ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    coordinator_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    notes = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("artist_id", "coordinator_id", name="uq_artist_coordinator_vouch"),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert vouch record to serializable dictionary."""
        return {
            "id": self.id,
            "artist_id": self.artist_id,
            "coordinator_id": self.coordinator_id,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class BookingRow(Base):
    """Database table storing booking negotiations, lifecycle states, roles, and standbys."""

    __tablename__ = "bookings"

    id = Column(String, primary_key=True, index=True)
    organizer_name = Column(String, nullable=False)
    art_form_requested = Column(String, nullable=False)
    event_date = Column(Date, nullable=False)
    event_time = Column(String, nullable=True, default="18:00")
    venue_address = Column(Text, nullable=True, default="")
    expected_duration_minutes = Column(Integer, nullable=False, default=60)
    group_size = Column(Integer, nullable=False, default=6)
    notes = Column(Text, nullable=True, default="")
    # Stored as integer PAISE (e.g. 25,000 INR = 2,500,000 paise)
    budget = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="REQUESTED", index=True)
    roles_needed = Column(JSON, nullable=False, default=list)
    standby_candidates = Column(JSON, nullable=False, default=dict)
    approval_expires_at = Column(DateTime, nullable=True)
    standby_reconfirmed = Column(Integer, nullable=False, default=0)
    standby_reconfirm_at = Column(DateTime, nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self, for_user: Optional[UserRow] = None) -> Dict[str, Any]:
        """Convert row to serializable dictionary with clear API boundary conversion and privacy masking."""
        venue = self.venue_address or ""
        # Requirement: Venue and contact details are hidden from artists until payment is received (PAID/PERFORMED/SETTLED)
        if for_user and getattr(for_user, "role", None) == "ARTIST":
            if self.status not in ["PAID", "PERFORMED", "SETTLED"]:
                venue = "Hidden until booking payment is received in escrow"

        now = datetime.utcnow()
        is_approval_expired = bool(self.approval_expires_at and now > self.approval_expires_at)

        return {
            "id": self.id,
            "organizer_name": self.organizer_name,
            "art_form_requested": self.art_form_requested,
            "event_date": self.event_date.isoformat() if isinstance(self.event_date, date) else self.event_date,
            "event_time": self.event_time or "18:00",
            "venue_address": venue,
            "expected_duration_minutes": self.expected_duration_minutes or 60,
            "group_size": self.group_size or 6,
            "notes": self.notes or "",
            "budget": self.budget // 100,  # Converted to INR at API boundary
            "budget_paise": self.budget,
            "status": self.status,
            "roles_needed": self.roles_needed or [],
            "standby_candidates": self.standby_candidates or {},
            "approval_expires_at": self.approval_expires_at.isoformat() if self.approval_expires_at else None,
            "approval_expired": is_approval_expired,
            "standby_reconfirmed": bool(self.standby_reconfirmed),
            "standby_reconfirm_at": self.standby_reconfirm_at.isoformat() if self.standby_reconfirm_at else None,
            "created_by_user_id": self.created_by_user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OrganizerProfileRow(Base):
    """Database table storing organizer company profiles and verification status."""

    __tablename__ = "organizer_profiles"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    organization_name = Column(String, nullable=False, default="")
    org_type = Column(String, nullable=False, default="individual")  # hotel | school | corporate | tour operator | individual
    gst_number = Column(String, nullable=True)
    work_email = Column(String, nullable=True)
    verification_status = Column(String, nullable=False, default="UNVERIFIED", index=True)  # UNVERIFIED | VERIFIED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "organization_name": self.organization_name,
            "org_type": self.org_type,
            "gst_number": self.gst_number,
            "work_email": self.work_email,
            "verification_status": self.verification_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }



class AuditLogRow(Base):
    """Database table storing chronological audit records of agent actions and state changes.

    APPEND-ONLY: Updates and deletions are strictly forbidden at ORM and DB level.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    actor = Column(String, nullable=False, default="SYSTEM")
    action = Column(String, nullable=False)
    details = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "actor": self.actor,
            "action": self.action,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Strict ORM-level enforcement of append-only audit logs
@event.listens_for(AuditLogRow, "before_update")
def prevent_audit_log_update(mapper, connection, target):
    raise RuntimeError("AuditLogRow is strictly append-only: updates are prohibited.")


@event.listens_for(AuditLogRow, "before_delete")
def prevent_audit_log_delete(mapper, connection, target):
    raise RuntimeError("AuditLogRow is strictly append-only: deletions are prohibited.")


def create_audit_triggers(bind) -> None:
    """Create database-level append-only triggers for the audit_logs table."""
    from sqlalchemy import text
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with bind.connect() if hasattr(bind, "connect") else bind.begin() as conn:
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
                BEFORE UPDATE ON audit_logs
                BEGIN
                    SELECT RAISE(ABORT, 'Audit log rows are append-only: updates prohibited');
                END;
            """))
            conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
                BEFORE DELETE ON audit_logs
                BEGIN
                    SELECT RAISE(ABORT, 'Audit log rows are append-only: deletes prohibited');
                END;
            """))
    elif dialect == "postgresql":
        with bind.connect() if hasattr(bind, "connect") else bind.begin() as conn:
            conn.execute(text("""
                CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Audit log rows are append-only: updates and deletes are prohibited';
                END;
                $$ LANGUAGE plpgsql;
            """))
            conn.execute(text("""
                DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
                CREATE TRIGGER trg_prevent_audit_log_update
                BEFORE UPDATE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
            """))
            conn.execute(text("""
                DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
                CREATE TRIGGER trg_prevent_audit_log_delete
                BEFORE DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
            """))


class TrustPayRow(Base):
    """Database table managing escrow milestones and payouts."""

    __tablename__ = "trustpay_records"

    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True, index=True)
    order_id = Column(String, nullable=True)
    txn_id = Column(String, nullable=True)
    organizer_payment_status = Column(String, nullable=False, default="NOT_PAID")
    payout_id = Column(String, nullable=True)
    artist_payout_status = Column(String, nullable=False, default="NOT_STARTED")
    artist_ack_status = Column(String, nullable=False, default="NOT_ACKNOWLEDGED")
    # Stored as integer PAISE
    amount = Column(Integer, nullable=False, default=0)
    platform_fee_paise = Column(Integer, nullable=False, default=0)
    fee_gst_paise = Column(Integer, nullable=False, default=0)
    payout_mode = Column(String, nullable=False, default="ROUTE")  # ROUTE | MANUAL
    dispute_window_hours = Column(Integer, nullable=False, default=48)
    operator_approved_early = Column(Boolean, nullable=False, default=False)
    refund_id = Column(String, nullable=True)
    refund_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary with clear API boundary conversion."""
        total_paise = self.amount + self.platform_fee_paise + self.fee_gst_paise
        return {
            "booking_id": self.booking_id,
            "order_id": self.order_id,
            "txn_id": self.txn_id,
            "organizer_payment_status": self.organizer_payment_status,
            "payout_id": self.payout_id,
            "artist_payout_status": self.artist_payout_status,
            "artist_ack_status": self.artist_ack_status,
            "amount": self.amount // 100,  # Converted to INR at API boundary
            "amount_paise": self.amount,
            "platform_fee": self.platform_fee_paise // 100,
            "platform_fee_paise": self.platform_fee_paise,
            "fee_gst": self.fee_gst_paise // 100,
            "fee_gst_paise": self.fee_gst_paise,
            "total_organizer_amount": total_paise // 100,
            "total_organizer_paise": total_paise,
            "payout_mode": self.payout_mode,
            "dispute_window_hours": self.dispute_window_hours,
            "operator_approved_early": self.operator_approved_early,
            "refund_id": self.refund_id,
            "refund_amount": self.refund_amount // 100,
            "refund_amount_paise": self.refund_amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ReconciliationTicketRow(Base):
    """Database table tracking payout failures, retries, and disputes."""

    __tablename__ = "reconciliation_tickets"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="OPEN", index=True)
    # Stored as integer PAISE
    claimed_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "reason": self.reason,
            "status": self.status,
            "claimed_amount": self.claimed_amount // 100,
            "claimed_amount_paise": self.claimed_amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class WebhookEventRow(Base):
    """Database table recording incoming webhook events for strict idempotency."""

    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True, index=True)  # Razorpay event ID (e.g. event_xxx)
    event_type = Column(String, nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    processed = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "processed": self.processed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class NotificationLogRow(Base):
    """Database table recording outbound notification attempts, channels, statuses, and retries."""

    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient = Column(String, nullable=False, index=True)  # Phone number, email, or user identifier
    channel = Column(String, nullable=False, index=True)  # whatsapp | email | in_app
    event_type = Column(String, nullable=False, index=True)
    template_name = Column(String, nullable=False)
    language = Column(String, nullable=False, default="hi")
    context_data = Column(JSON, nullable=False, default=dict)
    status = Column(String, nullable=False, default="PENDING", index=True)  # PENDING | SENT | FAILED
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "recipient": self.recipient,
            "channel": self.channel,
            "event_type": self.event_type,
            "template_name": self.template_name,
            "language": self.language,
            "context_data": self.context_data or {},
            "status": self.status,
            "retry_count": self.retry_count,
            "error_message": self.error_message,
            "next_retry_at": self.next_retry_at.isoformat() if self.next_retry_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SingleUseActionTokenRow(Base):
    """Database table storing signed, single-use, expiring action tokens for artist approvals."""

    __tablename__ = "single_use_action_tokens"

    id = Column(String, primary_key=True, index=True)  # Token string
    token_hash = Column(String, unique=True, nullable=False, index=True)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    artist_id = Column(String, ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)  # APPROVE | DECLINE
    expires_at = Column(DateTime, nullable=False, index=True)
    consumed = Column(Boolean, nullable=False, default=False, index=True)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "artist_id": self.artist_id,
            "action": self.action,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "consumed": self.consumed,
            "consumed_at": self.consumed_at.isoformat() if self.consumed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class VoiceProposalRow(Base):
    """Database table storing proposed structured artist rules from audio voice notes.

    CRITICAL GUARDRAIL: Rules are proposals only and NEVER applied automatically to ArtistRow.
    The artist must explicitly confirm via button tap.
    """

    __tablename__ = "voice_proposals"

    id = Column(String, primary_key=True, index=True)  # vp_<uuid>
    artist_id = Column(String, ForeignKey("artists.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    audio_url = Column(String, nullable=True)
    transcript = Column(Text, nullable=False)
    proposed_changes = Column(JSON, nullable=False, default=dict)
    status = Column(String, nullable=False, default="AWAITING_CONFIRMATION", index=True)  # AWAITING_CONFIRMATION | CONFIRMED | REJECTED
    applied = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        """Convert row to serializable dictionary."""
        return {
            "id": self.id,
            "artist_id": self.artist_id,
            "user_id": self.user_id,
            "audio_url": self.audio_url,
            "transcript": self.transcript,
            "proposed_changes": self.proposed_changes or {},
            "status": self.status,
            "applied": self.applied,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# -----------------------------------------------------------------------------
# Database Lifecycle & Connection Helpers
# -----------------------------------------------------------------------------

def init_db() -> None:
    """Create all tables in the database."""
    eng = get_engine()
    Base.metadata.create_all(bind=eng)
    create_audit_triggers(eng)


def reset_db() -> None:
    """Drop and recreate all database tables (test helper)."""
    eng = get_engine()
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    create_audit_triggers(eng)


def get_db() -> Generator[Session, None, None]:
    """Dependency helper yielding a SQLAlchemy session."""
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    db = session_factory()
    try:
        yield db
    finally:
        db.close()
