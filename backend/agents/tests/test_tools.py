"""Tests for agent tools, validation guards, audit integration, and LLM providers."""

from datetime import date
import pytest
from sqlalchemy.orm import Session

from backend.agents.llm import llm_call, set_scripted_responses
from backend.agents.tools import (
    TOOL_REGISTRY,
    check_standby_candidate,
    execute_tool,
    get_tool_schemas,
    propose_offer,
)
from backend.audit import get_audit_log
from backend.database import BookingRow, SessionLocal, reset_db
from backend.seed import seed_database


@pytest.fixture
def test_db():
    """Reset and seed the database for each test."""
    reset_db()
    session = SessionLocal()
    seed_database(db=session)
    try:
        yield session
    finally:
        session.close()


def test_propose_offer_below_min_fee_rejects_and_audits(test_db: Session):
    """Proposing an offer below the artist's min_fee returns rejection and logs OFFER_REJECTED."""
    booking_id = "booking_rej_001"

    # dance_kalbelia_01 min_fee is 1400000 paise; propose 1000000 paise
    result = propose_offer(
        booking_id=booking_id,
        artist_id="dance_kalbelia_01",
        price=1000000,
        event_date="2026-11-20",
        distance_km=100,
        duration_minutes=60,
        group_size=6,
        db=test_db,
    )

    assert result["valid"] is False
    assert result["status"] == "REJECTED"
    assert any(v["rule"] == "MIN_FEE" for v in result["violations"])

    # Verify audit record
    audit_entries = get_audit_log(booking_id=booking_id, db=test_db)
    assert len(audit_entries) == 1
    assert audit_entries[0]["action"] == "OFFER_REJECTED"
    assert audit_entries[0]["actor"] == "RULES_ENGINE"
    assert audit_entries[0]["details"]["price"] == 1000000


def test_valid_offer_writes_offer_proposed(test_db: Session):
    """A valid offer passes rules and writes an OFFER_PROPOSED audit row."""
    booking_id = "booking_prop_002"

    # dance_kalbelia_01 min_fee is 1400000 paise; propose 1600000 paise
    result = propose_offer(
        booking_id=booking_id,
        artist_id="dance_kalbelia_01",
        price=1600000,
        event_date="2026-11-20",
        distance_km=100,
        duration_minutes=60,
        group_size=6,
        db=test_db,
    )

    assert result["valid"] is True
    assert result["status"] == "PROPOSED"
    assert result["offer"]["price"] == 1600000

    # Verify audit record
    audit_entries = get_audit_log(booking_id=booking_id, db=test_db)
    assert len(audit_entries) == 1
    assert audit_entries[0]["action"] == "OFFER_PROPOSED"
    assert audit_entries[0]["actor"] == "ORGANIZER_AGENT"
    assert audit_entries[0]["details"]["price"] == 1600000


def test_check_standby_candidate_different_art_form_needs_approval(test_db: Session):
    """Checking a standby with a different art form requires organizer approval."""
    booking_id = "booking_standby_003"

    # Create a booking requesting Kalbelia Dance
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jaipur Cultural Forum",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        budget=1500000,
        status="NEGOTIATING",
    )
    test_db.add(booking)
    test_db.commit()

    # dance_ghoomar_02 performs Ghoomar Dance
    result = check_standby_candidate(
        booking_id=booking_id,
        candidate_artist_id="dance_ghoomar_02",
        offered_price=1400000,
        db=test_db,
    )

    assert result["eligible"] is True
    assert result["needs_organizer_approval"] is True
    assert "DIFFERENT_ART_FORM" in result["approval_reasons"]

    # Verify audit log recorded STANDBY_CHECKED
    audit_entries = get_audit_log(booking_id=booking_id, db=test_db)
    assert len(audit_entries) == 1
    assert audit_entries[0]["action"] == "STANDBY_CHECKED"
    assert audit_entries[0]["details"]["candidate_artist_id"] == "dance_ghoomar_02"


def test_scripted_provider_returns_tool_calls_in_order(monkeypatch):
    """Scripted LLM provider returns configured tool calls sequentially."""
    monkeypatch.setenv("LLM_PROVIDER", "scripted")

    scripted = [
        {
            "text": "Finding artists...",
            "tool_calls": [
                {
                    "name": "search_artists",
                    "arguments": {
                        "art_form": "Kalbelia",
                        "event_date": "2026-11-20",
                        "max_distance_km": 150,
                    },
                }
            ],
        },
        {
            "text": "Proposing booking offer...",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": "b_123",
                        "artist_id": "dance_kalbelia_01",
                        "price": 15000,
                        "event_date": "2026-11-20",
                        "distance_km": 50,
                        "duration_minutes": 60,
                        "group_size": 4,
                    },
                }
            ],
        },
    ]

    set_scripted_responses(scripted)

    # First call
    resp1 = llm_call(
        system_prompt="You are a simulated assistant.",
        messages=[{"role": "user", "content": "Find me artists."}],
    )
    assert resp1["text"] == "Finding artists..."
    assert len(resp1["tool_calls"]) == 1
    assert resp1["tool_calls"][0]["name"] == "search_artists"
    assert resp1["tool_calls"][0]["arguments"]["art_form"] == "Kalbelia"

    # Second call
    resp2 = llm_call(
        system_prompt="You are a simulated assistant.",
        messages=[{"role": "user", "content": "Propose an offer."}],
    )
    assert resp2["text"] == "Proposing booking offer..."
    assert len(resp2["tool_calls"]) == 1
    assert resp2["tool_calls"][0]["name"] == "propose_offer"
    assert resp2["tool_calls"][0]["arguments"]["artist_id"] == "dance_kalbelia_01"


def test_no_privileged_actions_in_registry():
    """Confirm no tool in registry can approve bookings, approve for artists, or pay money."""
    forbidden_tokens = ["approve", "confirm", "pay", "release", "payout"]

    # Check registered functions
    for tool_name in TOOL_REGISTRY.keys():
        for forbidden in forbidden_tokens:
            assert forbidden not in tool_name.lower(), (
                f"Forbidden token '{forbidden}' detected in registered tool '{tool_name}'"
            )

    # Check schemas exposed to agents
    schemas = get_tool_schemas()
    for schema in schemas:
        tool_name = schema["name"]
        for forbidden in forbidden_tokens:
            assert forbidden not in tool_name.lower(), (
                f"Forbidden token '{forbidden}' detected in schema '{tool_name}'"
            )
