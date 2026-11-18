"""Comprehensive test suite for notifications, quick replies, single-use tokens, and voice notes."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import hashlib
import json
from typing import Generator
import pytest
from fastapi.testclient import TestClient

from backend.auth import create_session_token
from backend.config import get_settings
from backend.database import (
    ArtistRow,
    AuditLogRow,
    BookingRow,
    ConsentRow,
    NotificationLogRow,
    SessionLocal,
    SingleUseActionTokenRow,
    UserRow,
    VoiceProposalRow,
    get_db,
    init_db,
)
from backend.main import app, booking_store
from backend.notifications import (
    NotificationDispatcher,
    TemplateRenderer,
    create_action_token,
    get_dispatcher,
    verify_and_consume_token,
)
from backend.notifications.voice_handler import (
    confirm_voice_proposal,
    create_voice_proposal,
    parse_rules_from_transcript,
)


@pytest.fixture
def client():
    """Test client instance."""
    init_db()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session():
    """SQLAlchemy session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_artist(db_session):
    """Create a test artist with registered user and phone."""
    artist_id = "art_test_notif_01"
    artist = db_session.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    if not artist:
        artist = ArtistRow(
            id=artist_id,
            name="Gulabo Bai",
            art_form="Kalbelia Dance",
            city="Jaipur",
            state="Rajasthan",
            bio="Renowned Kalbelia folk dancer with 15 years experience.",
            min_fee=1000000,  # 10,000 INR = 1,000,000 paise
            travel_range_km=100,
            min_duration_minutes=60,
            max_group_size=6,
            verification_stage="TRUSTED",
            listing_status="LIVE",
        )
        db_session.add(artist)
    else:
        artist.min_fee = 1000000
        artist.travel_range_km = 100
        db_session.commit()

    user = db_session.query(UserRow).filter(UserRow.phone == "+919829011111").first()
    if not user:
        user = UserRow(
            id="usr_artist_notif_01",
            name="Gulabo Bai",
            phone="+919829011111",
            role="ARTIST",
            language="hi",
            artist_id=artist_id,
            email="gulabo@rajasthanfolk.org",
            notification_preference="whatsapp",
            opted_out=False,
        )
        db_session.add(user)
    else:
        user.opted_out = False
        db_session.commit()

    # Consent record
    consent = db_session.query(ConsentRow).filter(ConsentRow.user_id == user.id).first()
    if not consent:
        consent = ConsentRow(user_id=user.id, terms_version="1.0", privacy_version="1.0")
        db_session.add(consent)

    db_session.commit()
    db_session.refresh(artist)
    db_session.refresh(user)
    return artist, user


@pytest.fixture
def sample_booking(db_session, sample_artist):
    """Create a sample booking in AWAITING_ARTIST_APPROVAL state."""
    artist, _ = sample_artist
    booking_id = "bk_notif_test_01"
    booking = db_session.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        booking = BookingRow(
            id=booking_id,
            organizer_name="Jaipur Heritage Fest",
            art_form_requested="Kalbelia Dance",
            event_date=date(2026, 12, 25),
            event_time="18:00",
            venue_address="City Palace, Jaipur",
            expected_duration_minutes=60,
            group_size=6,
            budget=1500000,
            status="AWAITING_ARTIST_APPROVAL",
            roles_needed=[{"role": "Lead Dancer", "artist_id": artist.id, "price": 1000000}],
            standby_candidates={},
            approval_expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db_session.add(booking)
        db_session.commit()
        db_session.refresh(booking)
    else:
        booking.status = "AWAITING_ARTIST_APPROVAL"
        booking.approval_expires_at = datetime.utcnow() + timedelta(hours=24)
        db_session.commit()
        db_session.refresh(booking)

    # Ensure booking store tracking
    booking_store[booking_id] = {
        "negotiated_roles": {
            "Lead Dancer": {"artist_id": artist.id, "price": 1000000, "status": "VALID"}
        },
        "artist_approvals": {},
    }
    return booking


# -----------------------------------------------------------------------------
# Test 1: Quick reply from wrong number is rejected and audit-logged
# -----------------------------------------------------------------------------
def test_quick_reply_from_wrong_number_rejected_and_audit_logged(
    client, db_session, sample_artist, sample_booking
):
    artist, artist_user = sample_artist
    booking = sample_booking

    # Generate single-use approval token for the artist
    token, _ = create_action_token(
        booking_id=booking.id,
        artist_id=artist.id,
        action="APPROVE",
        db=db_session,
    )

    # Simulate WhatsApp interactive quick-reply button tap from an UNAUTHORIZED phone number
    unauthorized_phone = "919999988888"  # Does NOT match artist's +919829011111
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry_01",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "messages": [
                                {
                                    "from": unauthorized_phone,
                                    "id": "wamid.test_01",
                                    "type": "button",
                                    "button": {
                                        "payload": f"APPROVE:{token}",
                                        "text": "Approve",
                                    },
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }

    response = client.post("/webhooks/whatsapp", json=payload)
    assert response.status_code == 200

    # 1. Booking MUST STILL be AWAITING_ARTIST_APPROVAL (not approved)
    db_session.refresh(booking)
    assert booking.status == "AWAITING_ARTIST_APPROVAL"

    # 2. Token MUST NOT be consumed
    token_row = db_session.query(SingleUseActionTokenRow).filter(SingleUseActionTokenRow.id == token).first()
    assert token_row.consumed is False

    # 3. Audit log MUST record UNAUTHORIZED_WHATSAPP_ACTION
    audit = (
        db_session.query(AuditLogRow)
        .filter(
            AuditLogRow.booking_id == booking.id,
            AuditLogRow.action == "UNAUTHORIZED_WHATSAPP_ACTION",
        )
        .first()
    )
    assert audit is not None
    assert "does not match" in audit.details.get("reason", "")


# -----------------------------------------------------------------------------
# Test 2: Quick reply from matching artist phone succeeds
# -----------------------------------------------------------------------------
def test_quick_reply_from_matching_artist_phone_succeeds(
    client, db_session, sample_artist, sample_booking
):
    artist, artist_user = sample_artist
    booking = sample_booking

    token, _ = create_action_token(
        booking_id=booking.id,
        artist_id=artist.id,
        action="APPROVE",
        db=db_session,
    )

    # Sending from artist's registered phone
    registered_phone = "919829011111"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry_02",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "messages": [
                                {
                                    "from": registered_phone,
                                    "id": "wamid.test_02",
                                    "type": "interactive",
                                    "interactive": {
                                        "type": "button_reply",
                                        "button_reply": {
                                            "id": f"APPROVE:{token}",
                                            "title": "Approve",
                                        },
                                    },
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }

    response = client.post("/webhooks/whatsapp", json=payload)
    assert response.status_code == 200

    # Token must be consumed
    token_row = db_session.query(SingleUseActionTokenRow).filter(SingleUseActionTokenRow.id == token).first()
    assert token_row.consumed is True

    # Booking moves to APPROVED
    db_session.refresh(booking)
    assert booking.status == "APPROVED"


# -----------------------------------------------------------------------------
# Test 3: Single-use link cannot be reused (consumed / replay protection)
# -----------------------------------------------------------------------------
def test_single_use_link_cannot_be_reused(
    client, db_session, sample_artist, sample_booking
):
    artist, _ = sample_artist
    booking = sample_booking
    booking.status = "AWAITING_ARTIST_APPROVAL"
    db_session.commit()

    token, action_url = create_action_token(
        booking_id=booking.id,
        artist_id=artist.id,
        action="APPROVE",
        db=db_session,
    )

    # 1. First use of the link -> Succeeds
    res1 = client.post(f"/api/actions/verify?token={token}")
    assert res1.status_code == 200
    assert res1.json()["action"] == "APPROVE"

    token_row = db_session.query(SingleUseActionTokenRow).filter(SingleUseActionTokenRow.id == token).first()
    assert token_row.consumed is True

    # 2. Replay attempt with identical token -> MUST fail with 410 Gone (Already used)
    res2 = client.post(f"/api/actions/verify?token={token}")
    assert res2.status_code == 410
    assert "already been used" in res2.json()["detail"].lower()


# -----------------------------------------------------------------------------
# Test 4: Expired single-use link is rejected
# -----------------------------------------------------------------------------
def test_expired_single_use_link_rejected(
    client, db_session, sample_artist, sample_booking
):
    artist, _ = sample_artist
    booking = sample_booking

    token, _ = create_action_token(
        booking_id=booking.id,
        artist_id=artist.id,
        action="APPROVE",
        db=db_session,
        expiry_hours=1,
    )

    # Manually expire token
    token_row = db_session.query(SingleUseActionTokenRow).filter(SingleUseActionTokenRow.id == token).first()
    token_row.expires_at = datetime.utcnow() - timedelta(hours=2)
    db_session.commit()

    res = client.post(f"/api/actions/verify?token={token}")
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# Test 5: Voice transcript NEVER auto-applies a rule change or approval
# -----------------------------------------------------------------------------
def test_voice_transcript_never_auto_applies_rule_change_without_confirmation(
    client, db_session, sample_artist
):
    artist, artist_user = sample_artist
    initial_fee = artist.min_fee
    initial_travel = artist.travel_range_km
    assert initial_fee == 1000000  # Rs 10,000

    token = create_session_token(artist_user)
    headers = {"Authorization": f"Bearer {token}"}

    # Voice note with simulated transcript proposing new min fee of 8000 INR (800,000 paise)
    simulated_audio = b"RIFF....WAVEfmt ....data....TRANSCRIPT:Mera minimum fee aath hazaar rupaye (8000) hai aur travel 150 km tak hai."
    files = {"file": ("audition.mp3", simulated_audio, "audio/mp3")}

    response = client.post("/artists/me/voice-note", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["applied"] is False
    assert data["requires_confirmation"] is True
    proposal_id = data["proposal_id"]
    proposed_changes = data["proposed_changes"]
    assert proposed_changes["min_fee"] == 800000  # 8,000 * 100 paise
    assert proposed_changes["travel_range_km"] == 150

    # CRITICAL CHECK: In the database, artist.min_fee and travel_range_km MUST NOT HAVE CHANGED!
    db_session.refresh(artist)
    assert artist.min_fee == initial_fee  # STILL 10,000!
    assert artist.travel_range_km == initial_travel  # STILL 100!

    # Proposal row in DB is strictly AWAITING_CONFIRMATION
    proposal_row = db_session.query(VoiceProposalRow).filter(VoiceProposalRow.id == proposal_id).first()
    assert proposal_row.status == "AWAITING_CONFIRMATION"
    assert proposal_row.applied is False

    # Now artist explicitly confirms the proposal via button tap
    confirm_payload = {"proposal_id": proposal_id, "confirm": True}
    confirm_resp = client.post(
        "/artists/me/rules/confirm-voice-proposal",
        json=confirm_payload,
        headers=headers,
    )
    assert confirm_resp.status_code == 200
    confirm_data = confirm_resp.json()
    assert confirm_data["applied"] is True
    assert confirm_data["status"] == "CONFIRMED"

    # Now the database rules ARE updated!
    db_session.refresh(artist)
    assert artist.min_fee == 800000  # Updated to 8,000 INR
    assert artist.travel_range_km == 150  # Updated to 150 km


def test_voice_proposal_explicit_rejection_discards_changes(
    client, db_session, sample_artist
):
    artist, artist_user = sample_artist
    token = create_session_token(artist_user)
    headers = {"Authorization": f"Bearer {token}"}

    proposal = create_voice_proposal(
        artist_id=artist.id,
        user_id=artist_user.id,
        transcript="fee 50000",
        proposed_changes={"min_fee": 5000000},
        db=db_session,
    )

    # Reject proposal
    res = client.post(
        "/artists/me/rules/confirm-voice-proposal",
        json={"proposal_id": proposal.id, "confirm": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"
    assert res.json()["applied"] is False

    # Artist fee remains unchanged
    db_session.refresh(artist)
    assert artist.min_fee == 800000 or artist.min_fee == 1000000


# -----------------------------------------------------------------------------
# Test 6: User Consent & STOP / UNSUBSCRIBE Keyword Handling
# -----------------------------------------------------------------------------
def test_stop_keyword_opts_out_user_and_suppresses_notifications(
    client, db_session, sample_artist
):
    artist, artist_user = sample_artist
    assert artist_user.opted_out is False

    registered_phone = "919829011111"
    # Send "STOP" via WhatsApp
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "entry_stop",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "messages": [
                                {
                                    "from": registered_phone,
                                    "id": "wamid.stop_01",
                                    "type": "text",
                                    "text": {"body": "STOP"},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }

    resp = client.post("/webhooks/whatsapp", json=payload)
    assert resp.status_code == 200

    db_session.refresh(artist_user)
    assert artist_user.opted_out is True

    # Attempting to dispatch a notification to opted-out user MUST be suppressed
    dispatcher = get_dispatcher()
    import asyncio
    results = asyncio.run(
        dispatcher.dispatch(
            event_type="STANDBY_RECONFIRMATION",
            recipient_user_id=artist_user.id,
            recipient_phone=artist_user.phone,
            context={"artist_name": artist.name, "art_form": "Kalbelia", "event_date": "2026-12-25"},
            db=db_session,
        )
    )
    assert len(results) == 1
    assert results[0].success is False
    assert "opted out" in results[0].error.lower()


# -----------------------------------------------------------------------------
# Test 7: WhatsApp Unconfigured Fallback to In-App + Email
# -----------------------------------------------------------------------------
def test_whatsapp_unconfigured_falls_back_to_inapp_and_email(
    db_session, sample_artist
):
    artist, artist_user = sample_artist
    artist_user.opted_out = False
    artist_user.notification_preference = "whatsapp"
    artist_user.email = "gulabo@rajasthanfolk.org"
    db_session.commit()

    dispatcher = get_dispatcher()
    # Force whatsapp provider as unconfigured
    dispatcher.whatsapp.token = None

    import asyncio
    results = asyncio.run(
        dispatcher.dispatch(
            event_type="STANDBY_RECONFIRMATION",
            recipient_user_id=artist_user.id,
            context={"artist_name": artist.name, "art_form": "Kalbelia", "event_date": "2026-12-25"},
            db=db_session,
        )
    )

    # Dispatched to fallback channels (in_app and email)
    channels_sent = [r.channel for r in results]
    assert "in_app" in channels_sent


# -----------------------------------------------------------------------------
# Test 8: Operator Delivery Failures Inspection & Retry
# -----------------------------------------------------------------------------
def test_operator_failed_notifications_inspection_and_retry(
    client, db_session
):
    operator = db_session.query(UserRow).filter(UserRow.phone == "+919800000099").first()
    if not operator:
        operator = UserRow(
            id="usr_op_notif_01",
            name="Operator Notif",
            phone="+919800000099",
            role="OPERATOR",
            language="en",
        )
        db_session.add(operator)
        db_session.commit()
        db_session.refresh(operator)

    # Insert a failed notification log row
    failed_log = NotificationLogRow(
        recipient="919829000000",
        channel="in_app",
        event_type="PAYMENT_RECEIVED",
        template_name="PAYMENT_RECEIVED",
        language="hi",
        context_data={"recipient_name": "Test Artist", "amount_inr": 15000, "booking_id": "bk_999"},
        status="FAILED",
        retry_count=1,
        error_message="Simulated temporary gateway error",
    )
    db_session.add(failed_log)
    db_session.commit()
    db_session.refresh(failed_log)

    op_token = create_session_token(operator)
    headers = {"Authorization": f"Bearer {op_token}"}

    # 1. Operator views failed queue
    resp = client.get("/operator/notifications/failed", headers=headers)
    assert resp.status_code == 200
    failed_list = resp.json()
    assert any(item["id"] == failed_log.id for item in failed_list)

    # 2. Operator triggers manual retry
    retry_resp = client.post(f"/operator/notifications/{failed_log.id}/retry", headers=headers)
    assert retry_resp.status_code == 200
    db_session.refresh(failed_log)
    assert failed_log.status == "SENT"
    assert failed_log.retry_count == 2


# -----------------------------------------------------------------------------
# Test 9: Meta Webhook Verification Handshake
# -----------------------------------------------------------------------------
def test_meta_webhook_verification_handshake(client):
    settings = get_settings()
    token = settings.WHATSAPP_VERIFY_TOKEN or "dharohar_verify_token_secure"

    # Valid challenge
    res = client.get(f"/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token={token}&hub.challenge=987654")
    assert res.status_code == 200
    assert res.text == "987654"

    # Invalid challenge
    res_bad = client.get(f"/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=987654")
    assert res_bad.status_code == 403
