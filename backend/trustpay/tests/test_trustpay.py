"""Tests for TrustPay state machine, MockProvider, and reconciliation engine."""

from datetime import date
import pytest
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.database import BookingRow, ReconciliationTicketRow, SessionLocal, TrustPayRow, reset_db
from backend.trustpay.mock_provider import MockProvider
from backend.trustpay.reconciliation import open_ticket, refund_booking
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
def mock_provider() -> MockProvider:
    return MockProvider()


@pytest.fixture
def trustpay_service(mock_provider: MockProvider) -> TrustPayService:
    return TrustPayService(provider=mock_provider)


@pytest.fixture
def approved_booking(test_db: Session) -> str:
    """Create a booking in AWAITING_ARTIST_APPROVAL with artist approval recorded in audit."""
    booking_id = "bk_approved_100"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jaipur Heritage Fest",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        budget=15000,
        status="AWAITING_ARTIST_APPROVAL",
    )
    test_db.add(booking)
    test_db.commit()

    # Record artist approval
    log_event(
        booking_id=booking_id,
        actor="ARTIST",
        action="ARTIST_APPROVED",
        details={"approved_by": "dance_kalbelia_01"},
        db=test_db,
    )
    return booking_id


def test_payment_cannot_start_before_artist_approval(
    test_db: Session, trustpay_service: TrustPayService
):
    """Payment cannot start if artist approval is missing or booking status is invalid."""
    booking_id = "bk_unapproved_101"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Unapproved Event",
        art_form_requested="Ghoomar Dance",
        event_date=date(2026, 11, 20),
        budget=12000,
        status="AWAITING_ARTIST_APPROVAL",
    )
    test_db.add(booking)
    test_db.commit()

    # No ARTIST_APPROVED audit entry exists -> must fail
    with pytest.raises(ValueError, match="Artist approval has not been recorded"):
        trustpay_service.start_payment(booking_id=booking_id, db=test_db)


def test_payout_cannot_be_released_before_payment(
    test_db: Session, trustpay_service: TrustPayService, approved_booking: str
):
    """Payout release is rejected if organizer payment has not been received."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)

    # Attempting to release payout before recording organizer payment must fail
    with pytest.raises(ValueError, match="Organizer payment not yet RECEIVED"):
        trustpay_service.release_payout(
            booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
        )


def test_failed_payout_opens_ticket_and_retry_succeeds(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """Failed payout triggers reconciliation ticket and subsequent retry resolves."""
    # 1. Start and confirm organizer payment
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)

    # 2. Inject failure on next payout
    mock_provider.set_fail_next_payout(True)
    payout_res = trustpay_service.release_payout(
        booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
    )
    assert payout_res["status"] == "FAILED"

    # 3. Sync payout status -> triggers ticket creation and automatic retry
    trustpay_service.sync_payout(booking_id=approved_booking, db=test_db)

    # Verify ticket was opened and retry was executed
    tickets = (
        test_db.query(ReconciliationTicketRow)
        .filter(ReconciliationTicketRow.booking_id == approved_booking)
        .all()
    )
    assert len(tickets) >= 1
    assert tickets[0].status == "RESOLVED"

    # Verify trustpay record now has a retry payout
    record = (
        test_db.query(TrustPayRow)
        .filter(TrustPayRow.booking_id == approved_booking)
        .first()
    )
    assert record.artist_payout_status in ["PENDING", "SUCCESSFUL"]


def test_successful_payout_with_no_ack_stays_unclosed(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """A booking remains in PAID status if payout is SUCCESSFUL but unacknowledged."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.release_payout(
        booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
    )

    # Settle payout via time advancement
    mock_provider.advance_time()
    trustpay_service.sync_payout(booking_id=approved_booking, db=test_db)

    booking = test_db.query(BookingRow).filter(BookingRow.id == approved_booking).first()
    assert booking.status == "PAID"  # Stays unclosed until artist confirms


def test_confirmed_plus_successful_closes_booking(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """Booking transitions to CLOSED only when payout is SUCCESSFUL and artist CONFIRMS."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.release_payout(
        booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
    )

    # Advance time to settle payout
    mock_provider.advance_time()
    trustpay_service.sync_payout(booking_id=approved_booking, db=test_db)

    # Artist acknowledges and confirms receipt
    res = trustpay_service.artist_acknowledge(
        booking_id=approved_booking, confirmed=True, db=test_db
    )
    assert res["artist_ack_status"] == "CONFIRMED"
    assert res["booking_status"] == "CLOSED"

    booking = test_db.query(BookingRow).filter(BookingRow.id == approved_booking).first()
    assert booking.status == "CLOSED"


def test_disputed_does_not_close_booking(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """If an artist DISPUTES receipt, booking must NOT close."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.release_payout(
        booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
    )

    mock_provider.advance_time()
    trustpay_service.sync_payout(booking_id=approved_booking, db=test_db)

    # Artist disputes payout
    res = trustpay_service.artist_acknowledge(
        booking_id=approved_booking, confirmed=False, db=test_db
    )
    assert res["artist_ack_status"] == "DISPUTED"
    assert res["booking_status"] != "CLOSED"

    booking = test_db.query(BookingRow).filter(BookingRow.id == approved_booking).first()
    assert booking.status == "PAID"


def test_beneficiary_mismatch_reported_by_handle_non_receipt_claim(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """Beneficiary mismatch is flagged during non-receipt investigations."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)

    # Inject beneficiary mismatch
    mock_provider.set_beneficiary_mismatch(True)
    trustpay_service.release_payout(
        booking_id=approved_booking, artist_id="dance_kalbelia_01", db=test_db
    )

    findings = trustpay_service.handle_non_receipt_claim(
        booking_id=approved_booking, db=test_db
    )
    assert findings["finding"] == "BENEFICIARY_MISMATCH"
    assert "MISMATCHED" in findings["beneficiary"]


def test_refund_path_works(
    test_db: Session,
    mock_provider: MockProvider,
    trustpay_service: TrustPayService,
    approved_booking: str,
):
    """Refund cancels the booking and records refund in ticket."""
    trustpay_service.start_payment(booking_id=approved_booking, db=test_db)
    trustpay_service.record_organizer_payment(booking_id=approved_booking, db=test_db)

    ticket = open_ticket(
        booking_id=approved_booking, reason="Event cancelled by organizer", db=test_db
    )
    refund_res = refund_booking(
        ticket_id=ticket.id, service=trustpay_service, db=test_db
    )

    assert refund_res["status"] == "REFUNDED"
    assert refund_res["booking_status"] == "CANCELLED"

    booking = test_db.query(BookingRow).filter(BookingRow.id == approved_booking).first()
    assert booking.status == "CANCELLED"
