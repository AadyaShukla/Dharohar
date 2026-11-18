"""Tests for real Razorpay provider, signature verification, webhooks, fee math, and release rules."""

from datetime import date, datetime, time, timedelta
import hashlib
import hmac
import json
import pytest
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from fastapi.testclient import TestClient

from backend.audit import log_event
from backend.config import get_settings
from backend.database import (
    ArtistRow,
    AuditLogRow,
    BookingRow,
    ReconciliationTicketRow,
    SessionLocal,
    TrustPayRow,
    UserRow,
    WebhookEventRow,
    reset_db,
)
from backend.main import app
from backend.trustpay.fees import calculate_platform_fees
from backend.trustpay.razorpay_provider import RazorpayProvider
from backend.trustpay.reconciliation import open_ticket, refund_booking, reconcile_with_razorpay
from backend.trustpay.state_machine import TrustPayService


@pytest.fixture
def test_db():
    reset_db()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("PAYMENT_PROVIDER", "razorpay")
    monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_test_12345")
    monkeypatch.setenv("RAZORPAY_KEY_SECRET", "test_razorpay_secret_key_12345")
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", "whsec_test_secret_99999")
    return TestClient(app)


def test_razorpay_webhook_returns_404_when_provider_is_mock(monkeypatch):
    """The webhook route /webhooks/razorpay must return 404 when PAYMENT_PROVIDER=mock."""
    monkeypatch.setenv("PAYMENT_PROVIDER", "mock")
    c = TestClient(app)
    res = c.post("/webhooks/razorpay", content=b"{}")
    assert res.status_code == 404
    assert "disabled when PAYMENT_PROVIDER=mock" in res.json()["detail"]


# ---------------------------------------------------------------------------
# 1. Platform Fee Calculation Tests (Integer Paise)
# ---------------------------------------------------------------------------

def test_fee_calculation_in_paise_exact():
    """Verify platform fee and GST calculations strictly produce integer paise."""
    # ₹15,000 artist price = 1,500,000 paise
    base_paise = 1500000
    res = calculate_platform_fees(base_paise=base_paise, fee_percent=5.0, fee_gst_percent=18.0)

    # 5% platform fee = 75,000 paise (₹750)
    assert res["platform_fee_paise"] == 75000
    assert isinstance(res["platform_fee_paise"], int)

    # 18% GST on platform fee = 13,500 paise (₹135)
    assert res["fee_gst_paise"] == 13500
    assert isinstance(res["fee_gst_paise"], int)

    # Total paid by organizer = 1,500,000 + 75,000 + 13,500 = 1,588,500 paise (₹15,885)
    assert res["total_organizer_paise"] == 1588500
    assert isinstance(res["total_organizer_paise"], int)

    # Artist receives full base price without deduction
    assert res["artist_payout_paise"] == 1500000
    assert res["base_inr"] == 15000.0
    assert res["total_organizer_inr"] == 15885.0


def test_fee_calculation_rounding_and_edge_cases():
    """Verify odd amount rounding and zero edge case in integer paise."""
    # Zero amount
    zero_res = calculate_platform_fees(0, fee_percent=5.0, fee_gst_percent=18.0)
    assert zero_res["platform_fee_paise"] == 0
    assert zero_res["fee_gst_paise"] == 0
    assert zero_res["total_organizer_paise"] == 0

    # Negative amount raises ValueError
    with pytest.raises(ValueError, match="Base price cannot be negative"):
        calculate_platform_fees(-100)

    # Odd paise rounding: 1,433,333 paise (₹14,333.33)
    odd_res = calculate_platform_fees(1433333, fee_percent=5.0, fee_gst_percent=18.0)
    assert isinstance(odd_res["platform_fee_paise"], int)
    assert isinstance(odd_res["fee_gst_paise"], int)
    assert isinstance(odd_res["total_organizer_paise"], int)
    assert odd_res["total_organizer_paise"] == odd_res["base_paise"] + odd_res["platform_fee_paise"] + odd_res["fee_gst_paise"]


# ---------------------------------------------------------------------------
# 2. Signature Verification Tests (Good and Bad)
# ---------------------------------------------------------------------------

def test_payment_signature_verification_good_and_bad():
    """Verify HMAC signature verification rejects tampered signatures and accepts valid ones."""
    key_secret = "test_razorpay_secret_key_12345"
    provider = RazorpayProvider(key_id="rzp_test_12345", key_secret=key_secret)

    order_id = "order_test_998877"
    payment_id = "pay_test_112233"

    # Compute valid HMAC-SHA256 signature
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    valid_sig = hmac.new(key_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    # Good signature -> must return True
    assert provider.verify_payment_signature(order_id, payment_id, valid_sig) is True

    # Bad signatures -> must return False
    assert provider.verify_payment_signature(order_id, payment_id, "invalid_bad_sig_000") is False
    assert provider.verify_payment_signature(order_id, "different_payment_id", valid_sig) is False
    assert provider.verify_payment_signature("different_order_id", payment_id, valid_sig) is False


def test_webhook_signature_verification_good_and_bad():
    """Verify webhook signature verification against webhook secret."""
    webhook_secret = "whsec_test_secret_99999"
    provider = RazorpayProvider(key_id="rzp_test_12345", key_secret="dummy_key_secret")

    payload_body = json.dumps({"event": "payment.captured", "id": "evt_test_1"}).encode("utf-8")

    # Valid webhook signature
    valid_wh_sig = hmac.new(webhook_secret.encode("utf-8"), payload_body, hashlib.sha256).hexdigest()
    assert provider.verify_webhook_signature(payload_body, valid_wh_sig, secret=webhook_secret) is True

    # Bad webhook signature
    assert provider.verify_webhook_signature(payload_body, "tampered_wh_sig_bad", secret=webhook_secret) is False


# ---------------------------------------------------------------------------
# 3. Webhook Idempotency Tests
# ---------------------------------------------------------------------------

def test_webhook_idempotency_processes_event_only_once(test_db: Session, client: TestClient):
    """Ensure sending the same webhook event ID twice processes it only once."""
    booking_id = "bk_webhook_idem_01"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jaipur Heritage Hotel",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        budget=1500000,
        status="AWAITING_ARTIST_APPROVAL",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_idem_12345",
        organizer_payment_status="NOT_PAID",
        amount=1500000,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    webhook_payload = {
        "entity": "event",
        "id": "evt_idem_unique_99",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_idem_captured_99",
                    "order_id": "order_idem_12345",
                    "amount": 1588500,
                    "status": "captured",
                    "notes": {"booking_id": booking_id},
                }
            }
        },
    }
    body_bytes = json.dumps(webhook_payload).encode("utf-8")
    wh_secret = get_settings().RAZORPAY_WEBHOOK_SECRET or "dummy_secret"
    valid_sig = hmac.new(wh_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    # First webhook call -> must process event and update status to PAID
    res1 = client.post(
        "/webhooks/razorpay",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": valid_sig},
    )
    assert res1.status_code == 200
    assert res1.json()["event_id"] == "evt_idem_unique_99"

    # Check DB updated
    test_db.refresh(booking)
    test_db.refresh(trustpay)
    assert booking.status == "PAID"
    assert trustpay.organizer_payment_status == "RECEIVED"
    assert trustpay.txn_id == "pay_idem_captured_99"

    # Count stored webhook rows
    events_count = test_db.query(WebhookEventRow).filter(WebhookEventRow.id == "evt_idem_unique_99").count()
    assert events_count == 1

    # Second webhook call with same event id -> must be idempotent (no duplicate processing)
    res2 = client.post(
        "/webhooks/razorpay",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": valid_sig},
    )
    assert res2.status_code == 200
    assert res2.json()["message"] == "Event already processed"

    # Webhook row count remains exactly 1
    events_count_after = test_db.query(WebhookEventRow).filter(WebhookEventRow.id == "evt_idem_unique_99").count()
    assert events_count_after == 1


# ---------------------------------------------------------------------------
# 4. Failed Payment Webhook Handling
# ---------------------------------------------------------------------------

def test_webhook_payment_failed_event(test_db: Session, client: TestClient):
    """Verify payment.failed webhook records failure audit log without marking PAID."""
    booking_id = "bk_webhook_fail_01"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Udaipur Palace",
        art_form_requested="Manganiyar Music",
        event_date=date(2026, 11, 20),
        budget=1200000,
        status="AWAITING_ARTIST_APPROVAL",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_fail_9988",
        organizer_payment_status="NOT_PAID",
        amount=1200000,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    webhook_payload = {
        "entity": "event",
        "id": "evt_fail_9988",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_failed_123",
                    "order_id": "order_fail_9988",
                    "error_description": "Insufficient funds in bank account",
                    "notes": {"booking_id": booking_id},
                }
            }
        },
    }
    body_bytes = json.dumps(webhook_payload).encode("utf-8")
    wh_secret = get_settings().RAZORPAY_WEBHOOK_SECRET or "dummy_secret"
    valid_sig = hmac.new(wh_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    res = client.post(
        "/webhooks/razorpay",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Razorpay-Signature": valid_sig},
    )
    assert res.status_code == 200

    test_db.refresh(booking)
    test_db.refresh(trustpay)
    # Status remains NOT_PAID
    assert booking.status == "AWAITING_ARTIST_APPROVAL"
    assert trustpay.organizer_payment_status == "NOT_PAID"

    # Audit event was recorded
    fail_audit = test_db.query(AuditLogRow).filter(AuditLogRow.booking_id == booking_id).first()
    assert fail_audit is not None
    assert fail_audit.details.get("event") == "PAYMENT_FAILED"


# ---------------------------------------------------------------------------
# 5. Idempotent Refund Tests
# ---------------------------------------------------------------------------

def test_idempotent_refund_cancels_booking_and_avoids_duplicate_calls(test_db: Session):
    """Verify refund transitions status to REFUNDED and CANCELLED and is idempotent."""
    booking_id = "bk_refund_test_01"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Shekhawati Haveli",
        art_form_requested="Bhavai Dance",
        event_date=date(2026, 11, 20),
        budget=1500000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_refund_01",
        txn_id="pay_refund_txn_01",
        organizer_payment_status="RECEIVED",
        amount=1500000,
        platform_fee_paise=75000,
        fee_gst_paise=13500,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_rzp = MagicMock()
    mock_rzp.refund.return_value = {
        "refund_id": "rfnd_rzp_mock_01",
        "amount_paise": 1588500,
        "status": "REFUNDED",
    }
    service = TrustPayService(provider=mock_rzp)

    ticket = open_ticket(booking_id=booking_id, reason="Organizer requested cancellation", db=test_db)

    # First refund call
    res1 = refund_booking(ticket_id=ticket.id, service=service, db=test_db)
    assert res1["status"] == "REFUNDED"
    assert res1["refund_id"] == "rfnd_rzp_mock_01"
    assert mock_rzp.refund.call_count == 1

    test_db.refresh(booking)
    test_db.refresh(trustpay)
    assert booking.status == "CANCELLED"
    assert trustpay.organizer_payment_status == "REFUNDED"
    assert trustpay.refund_id == "rfnd_rzp_mock_01"

    # Second refund call (idempotent) -> must NOT call mock_rzp.refund again
    res2 = refund_booking(ticket_id=ticket.id, service=service, db=test_db)
    assert res2["status"] == "REFUNDED"
    assert res2["refund_id"] == "rfnd_rzp_mock_01"
    assert mock_rzp.refund.call_count == 1  # No duplicate provider API calls


# ---------------------------------------------------------------------------
# 6. Release Rule Tests (Requirement 8)
# ---------------------------------------------------------------------------

def test_release_rule_rejects_payout_before_event_date(test_db: Session):
    """Release rule: Reject payout if event date has not yet passed."""
    booking_id = "bk_rel_future_01"
    # Event is 3 days in the future
    future_date = date.today() + timedelta(days=3)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Pushkar Mela Host",
        art_form_requested="Kalbelia Dance",
        event_date=future_date,
        event_time="18:00",
        budget=1500000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_rel_01",
        txn_id="pay_rel_01",
        organizer_payment_status="RECEIVED",
        amount=1500000,
        dispute_window_hours=48,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    service = TrustPayService(provider=mock_provider)
    service.strict_release_rule = True

    # Payout release before event date must fail with clear error
    with pytest.raises(ValueError, match="Event date .* has not yet passed"):
        service.release_payout(booking_id=booking_id, db=test_db)


def test_release_rule_rejects_payout_during_48h_dispute_window(test_db: Session):
    """Release rule: Reject payout if event passed but 48h dispute window is still open."""
    booking_id = "bk_rel_window_02"
    # Event was yesterday (24 hours ago, so within 48h dispute window)
    yesterday = date.today() - timedelta(days=1)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jodhpur Folk Center",
        art_form_requested="Manganiyar Music",
        event_date=yesterday,
        event_time="18:00",
        budget=1200000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_rel_02",
        txn_id="pay_rel_02",
        organizer_payment_status="RECEIVED",
        amount=1200000,
        dispute_window_hours=48,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    service = TrustPayService(provider=mock_provider)
    service.strict_release_rule = True

    # Within 48 hours -> dispute window is still open
    with pytest.raises(ValueError, match="Dispute window of 48 hours is still open"):
        service.release_payout(booking_id=booking_id, db=test_db)


def test_release_rule_rejects_payout_when_active_dispute_open(test_db: Session):
    """Release rule: Reject payout if event passed and window closed, but dispute is OPEN."""
    booking_id = "bk_rel_dispute_03"
    # Event was 5 days ago (dispute window closed)
    past_date = date.today() - timedelta(days=5)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Desert Folk Tent",
        art_form_requested="Bhavai Dance",
        event_date=past_date,
        event_time="18:00",
        budget=1400000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_rel_03",
        txn_id="pay_rel_03",
        organizer_payment_status="RECEIVED",
        amount=1400000,
        dispute_window_hours=48,
        artist_ack_status="DISPUTED",
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    service = TrustPayService(provider=mock_provider)
    service.strict_release_rule = True

    # Active dispute open -> must reject release
    with pytest.raises(ValueError, match="An active dispute is open"):
        service.release_payout(booking_id=booking_id, db=test_db)


def test_release_rule_succeeds_after_dispute_window_closed(test_db: Session):
    """Release rule: Payout release succeeds when event passed and 48h dispute window closed."""
    booking_id = "bk_rel_success_04"
    # Event was 4 days ago (well past 48h window)
    past_date = date.today() - timedelta(days=4)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jaipur Royal Fort",
        art_form_requested="Kalbelia Dance",
        event_date=past_date,
        event_time="18:00",
        budget=1500000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_rel_04",
        txn_id="pay_rel_04",
        organizer_payment_status="RECEIVED",
        amount=1500000,
        dispute_window_hours=48,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    mock_provider.create_payout.return_value = {
        "payout_id": "trf_mock_rel_04",
        "status": "PENDING",
        "payout_mode": "ROUTE",
    }
    service = TrustPayService(provider=mock_provider)
    service.strict_release_rule = True

    res = service.release_payout(booking_id=booking_id, db=test_db)
    assert res["status"] == "PENDING"
    assert res["payout_id"] == "trf_mock_rel_04"

    test_db.refresh(trustpay)
    assert trustpay.payout_id == "trf_mock_rel_04"


def test_release_rule_succeeds_with_operator_early_approval(test_db: Session):
    """Release rule: Operator early approval allows immediate payout release."""
    booking_id = "bk_rel_early_05"
    # Future event
    future_date = date.today() + timedelta(days=5)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Lake Palace Event",
        art_form_requested="Ghoomar Dance",
        event_date=future_date,
        event_time="19:00",
        budget=1800000,
        status="PAID",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_rel_05",
        txn_id="pay_rel_05",
        organizer_payment_status="RECEIVED",
        amount=1800000,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    mock_provider.create_payout.return_value = {
        "payout_id": "trf_early_appr_05",
        "status": "PENDING",
        "payout_mode": "ROUTE",
    }
    service = TrustPayService(provider=mock_provider)
    service.strict_release_rule = True

    # Operator approves early -> release succeeds despite future date
    res = service.release_payout(
        booking_id=booking_id,
        operator_approved_early=True,
        db=test_db,
    )
    assert res["status"] == "PENDING"
    assert res["payout_id"] == "trf_early_appr_05"

    test_db.refresh(trustpay)
    assert trustpay.operator_approved_early is True


# ---------------------------------------------------------------------------
# 7. Razorpay Route & Manual Operator Payout Fallback
# ---------------------------------------------------------------------------

def test_payout_fallback_to_manual_operator_task_when_route_disabled(test_db: Session):
    """If Route is not enabled/linked for an artist, payout falls back to manual operator task."""
    booking_id = "bk_route_fallback_01"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Heritage Courtyard",
        art_form_requested="Kathputli Puppet",
        event_date=date.today() - timedelta(days=5),
        event_time="18:00",
        budget=1000000,
        status="PAID",
    )
    artist = ArtistRow(
        id="artist_unlinked_01",
        name="Bhagat Ram Puppet Troupe",
        art_form="Kathputli Puppet",
        city="Jaipur",
        linked_account_id=None,  # No Route linked account
        min_fee=1000000,
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_manual_01",
        txn_id="pay_manual_01",
        organizer_payment_status="RECEIVED",
        amount=1000000,
    )
    test_db.add(booking)
    test_db.add(artist)
    test_db.add(trustpay)
    test_db.commit()

    # RazorpayProvider without Route linked account
    provider = RazorpayProvider(key_id="rzp_test", key_secret="secret")
    service = TrustPayService(provider=provider)

    res = service.release_payout(booking_id=booking_id, artist_id="artist_unlinked_01", db=test_db)
    assert res["payout_mode"] == "MANUAL"
    assert "manual_pout_" in res["payout_id"]

    test_db.refresh(trustpay)
    assert trustpay.payout_mode == "MANUAL"

    # A reconciliation ticket for the operator is automatically opened
    ticket = test_db.query(ReconciliationTicketRow).filter(ReconciliationTicketRow.booking_id == booking_id).first()
    assert ticket is not None
    assert "Manual operator payout required" in ticket.reason


# ---------------------------------------------------------------------------
# 8. Periodic Reconciliation Job Test
# ---------------------------------------------------------------------------

def test_periodic_reconciliation_opens_ticket_on_mismatch(test_db: Session):
    """Reconciliation job detects payment captured in Razorpay but NOT_PAID in DB and opens ticket."""
    booking_id = "bk_recon_mismatch_01"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Amer Fort Festival",
        art_form_requested="Kalbelia Dance",
        event_date=date.today(),
        budget=1500000,
        status="AWAITING_ARTIST_APPROVAL",
    )
    trustpay = TrustPayRow(
        booking_id=booking_id,
        order_id="order_recon_99",
        organizer_payment_status="NOT_PAID",
        amount=1500000,
    )
    test_db.add(booking)
    test_db.add(trustpay)
    test_db.commit()

    mock_provider = MagicMock()
    # Razorpay shows payment captured for this order
    mock_provider.fetch_reconciliation_records.return_value = {
        "payments": [
            {"id": "pay_recon_captured_99", "order_id": "order_recon_99", "status": "captured", "amount": 1588500}
        ],
        "transfers": [],
    }

    summary = reconcile_with_razorpay(provider=mock_provider, days=7, db=test_db)
    assert summary["mismatches_found"] == 1
    assert len(summary["tickets_opened"]) == 1

    test_db.refresh(trustpay)
    assert trustpay.organizer_payment_status == "RECEIVED"
    assert trustpay.txn_id == "pay_recon_captured_99"
