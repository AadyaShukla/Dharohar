"""Tests for replacement compatibility engine."""

from datetime import date
import pytest

from backend.rules.artist_rules import Artist
from backend.rules.compatibility import (
    CompatibilityResult,
    EventRequest,
    check_standby,
    rank_candidates,
)


@pytest.fixture
def base_request() -> EventRequest:
    return EventRequest(
        art_form="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        price_budget=20000,
        distance_km=100,
        duration_minutes=60,
        group_size=6,
        language="Hindi",
    )


@pytest.fixture
def kalbelia_artist() -> Artist:
    return Artist(
        id="artist_k1",
        name="Thar Folk Ensemble",
        art_form="Kalbelia Dance",
        city="Jodhpur",
        min_fee=15000,
        blackout_dates=[date(2026, 12, 25)],
        travel_range_km=250,
        min_duration_minutes=60,
        max_group_size=8,
        rating=4.8,
        languages=["Hindi", "Rajasthani"],
    )


def test_eligible_same_art_form_candidate_within_budget(
    base_request: EventRequest, kalbelia_artist: Artist
):
    result = check_standby(
        request=base_request,
        candidate=kalbelia_artist,
        offered_price=20000,
    )
    assert result.eligible is True
    assert len(result.hard_failures) == 0
    assert result.needs_organizer_approval is False
    assert len(result.approval_reasons) == 0
    assert result.soft_scores["price_difference_inr"] == 0
    assert result.soft_scores["language_match"] is True


def test_candidate_below_min_fee_is_rejected(
    base_request: EventRequest, kalbelia_artist: Artist
):
    # kalbelia_artist min_fee is 15000; offer 12000
    result = check_standby(
        request=base_request,
        candidate=kalbelia_artist,
        offered_price=12000,
    )
    assert result.eligible is False
    assert any(failure["rule"] == "MIN_FEE" for failure in result.hard_failures)


def test_different_art_form_is_eligible_but_needs_approval(
    base_request: EventRequest,
):
    ghoomar_artist = Artist(
        id="artist_g1",
        name="Jaipur Ghoomar Troupe",
        art_form="Ghoomar Dance",  # Differs from Kalbelia Dance
        city="Jaipur",
        min_fee=18000,
        blackout_dates=[],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.9,
        languages=["Hindi"],
    )
    result = check_standby(
        request=base_request,
        candidate=ghoomar_artist,
        offered_price=20000,
    )
    assert result.eligible is True
    assert result.needs_organizer_approval is True
    assert "DIFFERENT_ART_FORM" in result.approval_reasons


def test_price_above_budget_tolerance():
    artist = Artist(
        id="artist_flex",
        name="Heritage Performers",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=10000,
        blackout_dates=[],
        travel_range_km=300,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.7,
        languages=["Hindi"],
    )

    # Case A: Budget 20,000, price 22,000 (+2,000 is exactly 10%, within tolerance)
    req_a = EventRequest(
        art_form="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        price_budget=20000,
        distance_km=100,
        duration_minutes=60,
        group_size=6,
    )
    result_within_tolerance = check_standby(
        request=req_a,
        candidate=artist,
        offered_price=22000,
        price_tolerance_pct=10.0,
    )
    assert result_within_tolerance.eligible is True
    assert "PRICE_ABOVE_TOLERANCE" not in result_within_tolerance.approval_reasons
    assert result_within_tolerance.needs_organizer_approval is False

    # Case B: Budget 15,000, price 17,000 (+2,000 is 13.33%, beyond 10% tolerance)
    req_b = EventRequest(
        art_form="Kalbelia Dance",
        event_date=date(2026, 11, 20),
        price_budget=15000,
        distance_km=100,
        duration_minutes=60,
        group_size=6,
    )
    result_beyond_tolerance = check_standby(
        request=req_b,
        candidate=artist,
        offered_price=17000,
        price_tolerance_pct=10.0,
    )
    assert result_beyond_tolerance.eligible is True
    assert "PRICE_ABOVE_TOLERANCE" in result_beyond_tolerance.approval_reasons
    assert result_beyond_tolerance.needs_organizer_approval is True


def test_candidate_on_blackout_date_rejected(
    base_request: EventRequest, kalbelia_artist: Artist
):
    # Set request date to artist's blackout date (2026-12-25)
    blackout_request = EventRequest(
        art_form=base_request.art_form,
        event_date=date(2026, 12, 25),
        price_budget=base_request.price_budget,
        distance_km=base_request.distance_km,
        duration_minutes=base_request.duration_minutes,
        group_size=base_request.group_size,
    )
    result = check_standby(
        request=blackout_request,
        candidate=kalbelia_artist,
        offered_price=20000,
    )
    assert result.eligible is False
    assert any(failure["rule"] == "BLACKOUT_DATE" for failure in result.hard_failures)


def test_ranking_order(base_request: EventRequest):
    # Candidate 1: no approval, price diff 0, rating 4.7
    c1 = Artist(
        id="c1",
        name="Candidate 1",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=20000,
        blackout_dates=[],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.7,
    )
    # Candidate 2: no approval, price diff 1000 (within 10%), rating 4.9
    c2 = Artist(
        id="c2",
        name="Candidate 2",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=21000,
        blackout_dates=[],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.9,
    )
    # Candidate 3: no approval, price diff 1000 (within 10%), rating 4.5
    c3 = Artist(
        id="c3",
        name="Candidate 3",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=21000,
        blackout_dates=[],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.5,
    )
    # Candidate 4: needs approval (different art form), price diff 0, rating 5.0
    c4 = Artist(
        id="c4",
        name="Candidate 4",
        art_form="Bhavai Folk",
        city="Jaipur",
        min_fee=20000,
        blackout_dates=[],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=5.0,
    )
    # Candidate 5: ineligible (blackout date)
    c5 = Artist(
        id="c5",
        name="Candidate 5",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=20000,
        blackout_dates=[base_request.event_date],
        travel_range_km=200,
        min_duration_minutes=60,
        max_group_size=10,
        rating=4.9,
    )

    ranked = rank_candidates(base_request, [c5, c4, c3, c2, c1])

    # c5 must be excluded as ineligible
    # Among eligible:
    # 1. c1 (no approval, diff 0)
    # 2. c2 (no approval, diff 1000, rating 4.9)
    # 3. c3 (no approval, diff 1000, rating 4.5)
    # 4. c4 (needs approval, diff 0, rating 5.0)
    assert [c.id for c in ranked] == ["c1", "c2", "c3", "c4"]
