"""Tests for deterministic artist rules engine."""

from datetime import date
import pytest

from backend.rules.artist_rules import Artist, Offer, validate_offer


@pytest.fixture
def sample_artist() -> Artist:
    return Artist(
        id="artist_kalbelia_01",
        name="Gulabo Sapera Troupe",
        art_form="Kalbelia Dance",
        city="Jaipur",
        min_fee=15000,
        blackout_dates=[date(2026, 12, 25), date(2026, 12, 31)],
        travel_range_km=250,
        min_duration_minutes=60,
        max_group_size=8,
        rating=4.9,
        languages=["Hindi", "Rajasthani", "Marwari"],
    )


@pytest.fixture
def valid_offer() -> Offer:
    return Offer(
        artist_id="artist_kalbelia_01",
        price=20000,
        event_date=date(2026, 11, 20),
        distance_km=100,
        duration_minutes=90,
        group_size=6,
    )


def test_valid_offer_passes(sample_artist: Artist, valid_offer: Offer):
    result = validate_offer(sample_artist, valid_offer)
    assert result.passed is True
    assert len(result.violations) == 0


def test_below_min_fee_fails_with_min_fee(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=12000,  # Below 15000 min_fee
        event_date=valid_offer.event_date,
        distance_km=valid_offer.distance_km,
        duration_minutes=valid_offer.duration_minutes,
        group_size=valid_offer.group_size,
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is False
    assert len(result.violations) == 1
    assert result.violations[0]["rule"] == "MIN_FEE"
    assert "₹12000" in result.violations[0]["message"]
    assert "₹15000" in result.violations[0]["message"]


def test_offer_exactly_equal_to_min_fee_passes(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=15000,  # Exactly equal to min_fee
        event_date=valid_offer.event_date,
        distance_km=valid_offer.distance_km,
        duration_minutes=valid_offer.duration_minutes,
        group_size=valid_offer.group_size,
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is True
    assert len(result.violations) == 0


def test_blackout_date_fails(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=valid_offer.price,
        event_date=date(2026, 12, 25),  # Blackout date
        distance_km=valid_offer.distance_km,
        duration_minutes=valid_offer.duration_minutes,
        group_size=valid_offer.group_size,
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is False
    assert len(result.violations) == 1
    assert result.violations[0]["rule"] == "BLACKOUT_DATE"
    assert "2026-12-25" in result.violations[0]["message"]


def test_distance_over_range_fails(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=valid_offer.price,
        event_date=valid_offer.event_date,
        distance_km=300,  # Exceeds 250 km limit
        duration_minutes=valid_offer.duration_minutes,
        group_size=valid_offer.group_size,
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is False
    assert len(result.violations) == 1
    assert result.violations[0]["rule"] == "TRAVEL_RANGE"
    assert "300 km" in result.violations[0]["message"]


def test_min_duration_fails(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=valid_offer.price,
        event_date=valid_offer.event_date,
        distance_km=valid_offer.distance_km,
        duration_minutes=45,  # Less than min 60 minutes
        group_size=valid_offer.group_size,
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is False
    assert len(result.violations) == 1
    assert result.violations[0]["rule"] == "MIN_DURATION"
    assert "45 mins" in result.violations[0]["message"]


def test_group_size_fails(sample_artist: Artist, valid_offer: Offer):
    offer = Offer(
        artist_id=valid_offer.artist_id,
        price=valid_offer.price,
        event_date=valid_offer.event_date,
        distance_km=valid_offer.distance_km,
        duration_minutes=valid_offer.duration_minutes,
        group_size=12,  # Exceeds max 8
    )
    result = validate_offer(sample_artist, offer)
    assert result.passed is False
    assert len(result.violations) == 1
    assert result.violations[0]["rule"] == "GROUP_SIZE"
    assert "12" in result.violations[0]["message"]


def test_multiple_violations_are_all_reported_together(sample_artist: Artist):
    # Offer violating all 5 rules simultaneously
    bad_offer = Offer(
        artist_id="artist_kalbelia_01",
        price=5000,                     # Below 15000 -> MIN_FEE
        event_date=date(2026, 12, 31),   # In blackout_dates -> BLACKOUT_DATE
        distance_km=500,                # Above 250 -> TRAVEL_RANGE
        duration_minutes=30,            # Below 60 -> MIN_DURATION
        group_size=15,                  # Above 8 -> GROUP_SIZE
    )
    result = validate_offer(sample_artist, bad_offer)
    assert result.passed is False
    assert len(result.violations) == 5

    violated_rules = [v["rule"] for v in result.violations]
    assert violated_rules == [
        "MIN_FEE",
        "BLACKOUT_DATE",
        "TRAVEL_RANGE",
        "MIN_DURATION",
        "GROUP_SIZE",
    ]
