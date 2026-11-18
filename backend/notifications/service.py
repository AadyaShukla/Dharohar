"""High-level notification service helpers connecting domain events to the dispatcher."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.database import ArtistRow, BookingRow, SessionLocal, UserRow
from backend.logging_config import logger
from backend.notifications.dispatcher import get_dispatcher
from backend.notifications.tokens import create_action_token


def _run_async_dispatch(coro) -> None:
    """Safely execute async dispatch in background task or new event loop."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        # No running loop, run in a new thread or loop
        try:
            asyncio.run(coro)
        except Exception as e:
            logger.error("notification_sync_dispatch_error", extra={"error": str(e)})


def notify_offer_awaiting_approval(
    booking: BookingRow,
    roles_outcome: Dict[str, Any],
    db: Session,
) -> None:
    """Issue signed, single-use, expiring tokens and dispatch OFFER_AWAITING_APPROVAL to each artist."""
    for role_name, r_info in roles_outcome.items():
        if not isinstance(r_info, dict):
            continue
        artist_id = r_info.get("artist_id")
        if not artist_id or r_info.get("status") != "VALID":
            continue

        # Look up artist and user record
        artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
        user = db.query(UserRow).filter(UserRow.artist_id == artist_id).first()
        if not user:
            # Fallback to matching phone or name if user.artist_id is not set
            user = db.query(UserRow).filter(UserRow.name == (artist.name if artist else "")).first()

        # Generate signed, single-use, expiring tokens
        approve_token, approve_url = create_action_token(booking.id, artist_id, "APPROVE", db)
        decline_token, decline_url = create_action_token(booking.id, artist_id, "DECLINE", db)

        price_paise = r_info.get("price") or 1000000
        # If price is small (< 100,000), it might be in rupees, convert to rupees for context
        fee_inr = (price_paise // 100) if price_paise >= 100000 else price_paise

        evt_date = booking.event_date.isoformat() if isinstance(booking.event_date, date) else str(booking.event_date)

        ctx = {
            "artist_name": artist.name if artist else "Folk Artist",
            "art_form": artist.art_form if artist else booking.art_form_requested,
            "event_date": evt_date,
            "event_time": booking.event_time or "18:00",
            "duration_minutes": booking.expected_duration_minutes or 60,
            "fee_inr": fee_inr,
            "booking_id": booking.id,
            "approve_token": approve_token,
            "decline_token": decline_token,
            "approve_url": approve_url,
            "decline_url": decline_url,
        }

        coro = get_dispatcher().dispatch(
            event_type="OFFER_AWAITING_APPROVAL",
            recipient_user_id=user.id if user else None,
            recipient_phone=user.phone if user else None,
            recipient_email=user.email if user else None,
            context=ctx,
            preferred_channel=user.notification_preference if user else None,
            language=user.language if user else "hi",
        )
        _run_async_dispatch(coro)


def notify_standby_reconfirmation(
    booking: BookingRow,
    db: Session,
) -> None:
    """Dispatch STANDBY_RECONFIRMATION notice to all standby candidates."""
    standbys = booking.standby_candidates or {}
    evt_date = booking.event_date.isoformat() if isinstance(booking.event_date, date) else str(booking.event_date)

    for role_name, cands in standbys.items():
        if not isinstance(cands, list):
            continue
        for cand in cands:
            aid = cand.get("artist_id")
            if not aid:
                continue
            artist = db.query(ArtistRow).filter(ArtistRow.id == aid).first()
            user = db.query(UserRow).filter(UserRow.artist_id == aid).first()

            ctx = {
                "artist_name": cand.get("name") or (artist.name if artist else "Standby Artist"),
                "art_form": artist.art_form if artist else booking.art_form_requested,
                "event_date": evt_date,
                "booking_id": booking.id,
            }

            coro = get_dispatcher().dispatch(
                event_type="STANDBY_RECONFIRMATION",
                recipient_user_id=user.id if user else None,
                recipient_phone=user.phone if user else None,
                recipient_email=user.email if user else None,
                context=ctx,
                preferred_channel=user.notification_preference if user else None,
                language=user.language if user else "hi",
            )
            _run_async_dispatch(coro)


def notify_payment_received(
    booking_id: str,
    amount_paise: int,
    db: Session,
) -> None:
    """Dispatch PAYMENT_RECEIVED to organizer and assigned artists."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        return

    amount_inr = amount_paise // 100
    evt_date = booking.event_date.isoformat() if isinstance(booking.event_date, date) else str(booking.event_date)

    # 1. Notify Organizer
    organizer_user = None
    if booking.created_by_user_id:
        organizer_user = db.query(UserRow).filter(UserRow.id == booking.created_by_user_id).first()

    ctx_org = {
        "recipient_name": booking.organizer_name or "Organizer",
        "booking_id": booking.id,
        "amount_inr": amount_inr,
        "art_form": booking.art_form_requested,
        "event_date": evt_date,
    }
    coro_org = get_dispatcher().dispatch(
        event_type="PAYMENT_RECEIVED",
        recipient_user_id=organizer_user.id if organizer_user else None,
        recipient_phone=organizer_user.phone if organizer_user else None,
        recipient_email=organizer_user.email if organizer_user else None,
        context=ctx_org,
        preferred_channel=organizer_user.notification_preference if organizer_user else None,
        language=organizer_user.language if organizer_user else "en",
    )
    _run_async_dispatch(coro_org)

    # 2. Notify Assigned Artists
    for role in (booking.roles_needed or []):
        aid = role.get("artist_id") if isinstance(role, dict) else None
        if not aid:
            continue
        artist = db.query(ArtistRow).filter(ArtistRow.id == aid).first()
        user = db.query(UserRow).filter(UserRow.artist_id == aid).first()
        ctx_art = {
            "recipient_name": artist.name if artist else "Folk Artist",
            "booking_id": booking.id,
            "amount_inr": amount_inr,
            "art_form": artist.art_form if artist else booking.art_form_requested,
            "event_date": evt_date,
        }
        coro_art = get_dispatcher().dispatch(
            event_type="PAYMENT_RECEIVED",
            recipient_user_id=user.id if user else None,
            recipient_phone=user.phone if user else None,
            recipient_email=user.email if user else None,
            context=ctx_art,
            preferred_channel=user.notification_preference if user else None,
            language=user.language if user else "hi",
        )
        _run_async_dispatch(coro_art)


def notify_payout_status_change(
    booking_id: str,
    artist_id: str,
    amount_paise: int,
    status_label: str,
    details: str,
    db: Session,
) -> None:
    """Dispatch PAYOUT_STATUS_CHANGED to the artist."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    user = db.query(UserRow).filter(UserRow.artist_id == artist_id).first()

    ctx = {
        "artist_name": artist.name if artist else "Folk Artist",
        "booking_id": booking_id,
        "amount_inr": amount_paise // 100,
        "status_label": status_label,
        "status_details": details,
    }
    coro = get_dispatcher().dispatch(
        event_type="PAYOUT_STATUS_CHANGED",
        recipient_user_id=user.id if user else None,
        recipient_phone=user.phone if user else None,
        recipient_email=user.email if user else None,
        context=ctx,
        preferred_channel=user.notification_preference if user else None,
        language=user.language if user else "hi",
    )
    _run_async_dispatch(coro)


def notify_refund_processed(
    booking_id: str,
    refund_id: str,
    amount_paise: int,
    db: Session,
) -> None:
    """Dispatch REFUND_PROCESSED notice to organizer."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    organizer_user = None
    if booking and booking.created_by_user_id:
        organizer_user = db.query(UserRow).filter(UserRow.id == booking.created_by_user_id).first()

    ctx = {
        "organizer_name": booking.organizer_name if booking else "Organizer",
        "booking_id": booking_id,
        "amount_inr": amount_paise // 100,
        "refund_id": refund_id,
    }
    coro = get_dispatcher().dispatch(
        event_type="REFUND_PROCESSED",
        recipient_user_id=organizer_user.id if organizer_user else None,
        recipient_phone=organizer_user.phone if organizer_user else None,
        recipient_email=organizer_user.email if organizer_user else None,
        context=ctx,
        preferred_channel=organizer_user.notification_preference if organizer_user else None,
        language=organizer_user.language if organizer_user else "en",
    )
    _run_async_dispatch(coro)


def notify_dispute_opened(
    booking_id: str,
    ticket_id: int,
    reason: str,
    db: Session,
) -> None:
    """Dispatch DISPUTE_OPENED notification."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    ctx = {
        "booking_id": booking_id,
        "ticket_id": ticket_id,
        "reason": reason,
    }
    # Notify organizer if known
    if booking and booking.created_by_user_id:
        org_user = db.query(UserRow).filter(UserRow.id == booking.created_by_user_id).first()
        coro = get_dispatcher().dispatch(
            event_type="DISPUTE_OPENED",
            recipient_user_id=org_user.id if org_user else None,
            recipient_phone=org_user.phone if org_user else None,
            recipient_email=org_user.email if org_user else None,
            context=ctx,
            preferred_channel=org_user.notification_preference if org_user else None,
            language=org_user.language if org_user else "hi",
        )
        _run_async_dispatch(coro)


def notify_dispute_resolved(
    booking_id: str,
    ticket_id: int,
    resolution: str,
    db: Session,
) -> None:
    """Dispatch DISPUTE_RESOLVED notification."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    ctx = {
        "booking_id": booking_id,
        "ticket_id": ticket_id,
        "resolution": resolution,
    }
    if booking and booking.created_by_user_id:
        org_user = db.query(UserRow).filter(UserRow.id == booking.created_by_user_id).first()
        coro = get_dispatcher().dispatch(
            event_type="DISPUTE_RESOLVED",
            recipient_user_id=org_user.id if org_user else None,
            recipient_phone=org_user.phone if org_user else None,
            recipient_email=org_user.email if org_user else None,
            context=ctx,
            preferred_channel=org_user.notification_preference if org_user else None,
            language=org_user.language if org_user else "hi",
        )
        _run_async_dispatch(coro)


def notify_listing_review(
    artist_id: str,
    approved: bool,
    reason: Optional[str] = None,
    tier: Optional[str] = None,
    db: Optional[Session] = None,
) -> None:
    """Dispatch LISTING_APPROVED or LISTING_REJECTED."""
    local_db = db or SessionLocal()
    should_close = db is None

    try:
        artist = local_db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
        if not artist:
            return
        user = local_db.query(UserRow).filter(UserRow.artist_id == artist_id).first()

        if approved:
            ctx = {
                "artist_name": artist.name,
                "art_form": artist.art_form,
                "tier": tier or artist.verification_stage,
            }
            coro = get_dispatcher().dispatch(
                event_type="LISTING_APPROVED",
                recipient_user_id=user.id if user else None,
                recipient_phone=user.phone if user else None,
                recipient_email=user.email if user else None,
                context=ctx,
                preferred_channel=user.notification_preference if user else None,
                language=user.language if user else "hi",
            )
            _run_async_dispatch(coro)
        else:
            ctx = {
                "artist_name": artist.name,
                "reason": reason or "Requires profile details correction",
            }
            coro = get_dispatcher().dispatch(
                event_type="LISTING_REJECTED",
                recipient_user_id=user.id if user else None,
                recipient_phone=user.phone if user else None,
                recipient_email=user.email if user else None,
                context=ctx,
                preferred_channel=user.notification_preference if user else None,
                language=user.language if user else "hi",
            )
            _run_async_dispatch(coro)
    finally:
        if should_close:
            local_db.close()
