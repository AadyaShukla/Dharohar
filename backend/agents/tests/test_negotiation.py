"""Tests for agent coordination, negotiation flow, and status transition guards."""

from datetime import date
import pytest
from sqlalchemy.orm import Session

from backend.agents.artist_agent import run_artist_agent
from backend.agents.llm import set_scripted_responses
from backend.agents.negotiation import run_negotiation
from backend.agents.organizer_agent import run_organizer_agent
from backend.agents.tools import check_standby_candidate
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


def test_happy_path_both_roles_reach_awaiting_artist_approval(
    test_db: Session, monkeypatch
):
    """Both roles get valid offers and the booking status reaches AWAITING_ARTIST_APPROVAL."""
    monkeypatch.setenv("LLM_PROVIDER", "scripted")

    booking_id = "book_happy_001"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Jaipur Grand Fest",
        art_form_requested="Folk Showcase",
        event_date=date(2026, 11, 20),
        budget=3000000,
        status="NEGOTIATING",
    )
    test_db.add(booking)
    test_db.commit()

    request = {
        "event_date": "2026-11-20",
        "total_budget": 3000000,
        "distance_km": 100,
        "duration_minutes": 60,
        "group_size": 6,
        "roles": [
            {
                "role": "dance_group",
                "art_form": "Kalbelia Dance",
                "budget": 1600000,
            },
            {
                "role": "folk_musician",
                "art_form": "Manganiyar Folk Music",
                "budget": 1200000,
            },
        ],
    }

    # Scripted LLM responses for organizer agent and artist agents
    scripted = [
        # Organizer proposes for both roles
        {
            "text": "Proposing offers for dance and music.",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1500000,
                        "event_date": "2026-11-20",
                        "distance_km": 100,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                },
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "music_sarangi_03",
                        "price": 800000,
                        "event_date": "2026-11-20",
                        "distance_km": 100,
                        "duration_minutes": 60,
                        "group_size": 4,
                    },
                },
            ],
        },
        # Artist agent message for Kalbelia
        {"text": "प्रस्ताव स्वीकार्य है।"},
        # Artist agent message for Sarangi
        {"text": "The offer meets all requirements."},
    ]
    set_scripted_responses(scripted)

    result = run_negotiation(booking_id=booking_id, request=request, db=test_db)

    assert result["all_accepted"] is True
    assert result["status"] == "AWAITING_ARTIST_APPROVAL"

    # Verify persisted booking status
    updated_booking = test_db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    assert updated_booking.status == "AWAITING_ARTIST_APPROVAL"


def test_below_min_offer_rejected_and_reproposed_at_minimum(
    test_db: Session, monkeypatch
):
    """An offer below min fee is rejected and the agent re-proposes at or above minimum."""
    monkeypatch.setenv("LLM_PROVIDER", "scripted")

    booking_id = "book_reprop_002"
    request = {
        "event_date": "2026-11-20",
        "budget": 2000000,
        "roles": [
            {
                "role": "dance_group",
                "art_form": "Kalbelia Dance",
                "budget": 1600000,
            }
        ],
    }

    scripted = [
        # Iteration 1: propose below minimum fee (1,000,000 < 1,400,000 paise)
        {
            "text": "Attempting low offer.",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1000000,
                        "event_date": "2026-11-20",
                        "distance_km": 100,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        # Iteration 2: adjust after reading violation, propose at 1,400,000 paise
        {
            "text": "Re-proposing at artist minimum fee.",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1400000,
                        "event_date": "2026-11-20",
                        "distance_km": 100,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
    ]
    set_scripted_responses(scripted)

    result = run_organizer_agent(booking_id=booking_id, request=request, db=test_db)
    roles = result["roles"]
    assert roles["dance_group"]["status"] == "VALID"
    assert roles["dance_group"]["price"] == 1400000
    assert roles["dance_group"]["artist_id"] == "dance_kalbelia_01"


def test_unavailable_musician_standby_flagging(test_db: Session):
    """A different art form and high price standbys are flagged, compatible third passes."""
    booking_id = "book_musician_blackout"
    # Booking requesting Manganiyar Music on 2026-12-20 (blackout date for Desert Sarangi Swar)
    booking = BookingRow(
        id=booking_id,
        organizer_name="Winter Desert Fest",
        art_form_requested="Manganiyar Folk Music",
        event_date=date(2026, 12, 20),
        budget=1000000,
        status="NEGOTIATING",
    )
    test_db.add(booking)
    test_db.commit()

    # 1. Candidate 1: puppet_kathputli_01 -> different art form
    cand1 = check_standby_candidate(
        booking_id=booking_id,
        candidate_artist_id="puppet_kathputli_01",
        offered_price=1000000,
        db=test_db,
    )
    assert cand1["eligible"] is True
    assert cand1["needs_organizer_approval"] is True
    assert "DIFFERENT_ART_FORM" in cand1["approval_reasons"]

    # 2. Candidate 2: music_pandavani_02 -> offered_price 1,200,000 paise (exceeds 1,000,000 budget by 20% > 10%)
    cand2 = check_standby_candidate(
        booking_id=booking_id,
        candidate_artist_id="music_pandavani_02",
        offered_price=1200000,
        db=test_db,
    )
    assert cand2["eligible"] is True
    assert cand2["needs_organizer_approval"] is True
    assert "PRICE_ABOVE_TOLERANCE" in cand2["approval_reasons"]

    # 3. Candidate 3: music_pandavani_03 -> offered_price within budget
    assert cand1["needs_organizer_approval"] is True
    assert cand2["needs_organizer_approval"] is True


def test_artist_agent_counters_at_exactly_min_fee(test_db: Session, monkeypatch):
    """The artist agent counters at exactly artist.min_fee and never below."""
    monkeypatch.setenv("LLM_PROVIDER", "scripted")
    set_scripted_responses([{"text": "Fee is too low, countering."}])

    booking_id = "book_counter_004"
    # dance_kalbelia_01 has min_fee = 1400000 paise
    offer = {
        "price": 1150000,  # Below 1400000
        "event_date": "2026-11-20",
        "distance_km": 50,
        "duration_minutes": 60,
        "group_size": 6,
    }

    result = run_artist_agent(
        booking_id=booking_id,
        artist_id="dance_kalbelia_01",
        offer=offer,
        db=test_db,
    )

    assert result["decision"] == "COUNTER"
    assert result["counter_price"] == 1400000  # Exactly min_fee!
    assert result["counter_price"] > offer["price"]


def test_no_code_path_sets_approved_paid_closed(test_db: Session, monkeypatch):
    """Negotiation never transitions booking status to APPROVED, PAID, or CLOSED."""
    monkeypatch.setenv("LLM_PROVIDER", "scripted")

    booking_id = "book_safety_005"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Safety Check Fest",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        budget=2000000,
        status="NEGOTIATING",
    )
    test_db.add(booking)
    test_db.commit()

    request = {
        "event_date": "2026-11-20",
        "total_budget": 2000000,
        "roles": [
            {
                "role": "dance_group",
                "art_form": "Kalbelia Dance",
                "budget": 1600000,
            }
        ],
    }

    scripted = [
        {
            "text": "Offer proposed.",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1600000,
                        "event_date": "2026-11-20",
                        "distance_km": 50,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "Accepting terms."},
    ]
    set_scripted_responses(scripted)

    result = run_negotiation(booking_id=booking_id, request=request, db=test_db)

    # Status must NOT be APPROVED, PAID, or CLOSED
    assert result["status"] not in ["APPROVED", "PAID", "CLOSED"]
    assert result["status"] == "AWAITING_ARTIST_APPROVAL"

    updated = test_db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    assert updated.status not in ["APPROVED", "PAID", "CLOSED"]
