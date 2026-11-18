"""Tests for database seeding and chronological audit log persistence."""

from datetime import date
import pytest
from sqlalchemy.orm import Session

from backend.audit import get_audit_log, log_event
from backend.database import ArtistRow, BookingRow, SessionLocal, reset_db
from backend.seed import seed_database


@pytest.fixture
def test_db():
    """Create a clean database session for testing."""
    reset_db()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_seed_database_spread(test_db: Session):
    """Verify that seed_database populates 10 fictional artists with expected distribution."""
    artists = seed_database(db=test_db)
    assert len(artists) == 10

    # Query DB directly to verify persistence
    db_artists = test_db.query(ArtistRow).all()
    assert len(db_artists) == 10

    # Check art form categories
    art_forms = [a.art_form for a in db_artists]
    assert any("Kalbelia" in af for af in art_forms)
    assert any("Ghoomar" in af for af in art_forms)
    assert any("Bhavai" in af for af in art_forms)
    assert any("Chhau" in af for af in art_forms)
    assert any("Manganiyar" in af for af in art_forms)
    assert any("Kathputli" in af for af in art_forms)
    assert any("Tholu" in af for af in art_forms)
    assert any("Blue Pottery" in af for af in art_forms)

    # Check blackout date on musician
    manganiyar = test_db.query(ArtistRow).filter(ArtistRow.id == "music_manganiyar_01").first()
    assert manganiyar is not None
    assert "2026-12-20" in manganiyar.blackout_dates

    # Check fee range spread (in integer paise)
    min_fees = [a.min_fee for a in db_artists]
    assert min(min_fees) >= 6000 * 100
    assert max(min_fees) <= 15000 * 100


def test_audit_log_saved_and_retrieved_in_order(test_db: Session):
    """Log multiple sequential audit events and verify chronological retrieval."""
    test_booking_id = "book_sim_test_001"

    # Create dummy booking record
    booking = BookingRow(
        id=test_booking_id,
        organizer_name="Simulated Cultural Fest",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 12, 10),
        budget=18000,
        status="NEGOTIATING",
    )
    test_db.add(booking)
    test_db.commit()

    # Step 1: Organizer proposes an offer
    log_event(
        booking_id=test_booking_id,
        actor="ORGANIZER_AGENT",
        action="OFFER_PROPOSED",
        details={"price": 14000, "artist_id": "dance_kalbelia_01"},
        db=test_db,
    )

    # Step 2: Rules engine checks constraints
    log_event(
        booking_id=test_booking_id,
        actor="RULES_ENGINE",
        action="STANDBY_CHECKED",
        details={"eligible": True, "violations": []},
        db=test_db,
    )

    # Step 3: Artist agent accepts offer
    log_event(
        booking_id=test_booking_id,
        actor="ARTIST_AGENT",
        action="OFFER_ACCEPTED",
        details={"final_price": 14000, "terms_agreed": True},
        db=test_db,
    )

    # Step 4: Organizer confirms milestone
    log_event(
        booking_id=test_booking_id,
        actor="ORGANIZER",
        action="ORGANIZER_APPROVED_CHANGE",
        details={"milestone": "DEPOSIT_LOCKED"},
        db=test_db,
    )

    # Retrieve audit log
    logs = get_audit_log(booking_id=test_booking_id, db=test_db)

    assert len(logs) == 4

    # Verify chronological sequence of actions
    actions = [entry["action"] for entry in logs]
    assert actions == [
        "OFFER_PROPOSED",
        "STANDBY_CHECKED",
        "OFFER_ACCEPTED",
        "ORGANIZER_APPROVED_CHANGE",
    ]

    # Verify actors
    actors = [entry["actor"] for entry in logs]
    assert actors == [
        "ORGANIZER_AGENT",
        "RULES_ENGINE",
        "ARTIST_AGENT",
        "ORGANIZER",
    ]

    # Verify details payload intact
    assert logs[0]["details"]["price"] == 14000
    assert logs[1]["details"]["eligible"] is True
    assert logs[2]["details"]["final_price"] == 14000
    assert logs[3]["details"]["milestone"] == "DEPOSIT_LOCKED"
