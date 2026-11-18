"""Deterministic rules engine for evaluating artist offers without LLM or database dependencies."""

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List


@dataclass
class Artist:
    """Artist profile with constraints and booking requirements."""

    id: str
    name: str
    art_form: str
    city: str
    min_fee: int  # in INR
    blackout_dates: List[date]
    travel_range_km: int
    min_duration_minutes: int
    max_group_size: int
    rating: float
    languages: List[str] = field(default_factory=list)


@dataclass
class Offer:
    """Proposed booking offer submitted for an artist."""

    artist_id: str
    price: int  # in INR
    event_date: date
    distance_km: int
    duration_minutes: int
    group_size: int


@dataclass
class ValidationResult:
    """Outcome of evaluating an offer against artist rules."""

    passed: bool
    violations: List[Dict[str, str]]


def validate_offer(artist: Artist, offer: Offer) -> ValidationResult:
    """Evaluate an offer against all artist rules and collect all violations.

    Rules checked:
    1. MIN_FEE: offer.price >= artist.min_fee
    2. BLACKOUT_DATE: offer.event_date not in artist.blackout_dates
    3. TRAVEL_RANGE: offer.distance_km <= artist.travel_range_km
    4. MIN_DURATION: offer.duration_minutes >= artist.min_duration_minutes
    5. GROUP_SIZE: offer.group_size <= artist.max_group_size
    """
    violations: List[Dict[str, str]] = []

    # 1. MIN_FEE
    if offer.price < artist.min_fee:
        violations.append(
            {
                "rule": "MIN_FEE",
                "message": (
                    f"Offer price ₹{offer.price} is below artist minimum fee ₹{artist.min_fee}"
                ),
            }
        )

    # 2. BLACKOUT_DATE
    if offer.event_date in artist.blackout_dates:
        violations.append(
            {
                "rule": "BLACKOUT_DATE",
                "message": (
                    f"Event date {offer.event_date.isoformat()} falls on an artist blackout date"
                ),
            }
        )

    # 3. TRAVEL_RANGE
    if offer.distance_km > artist.travel_range_km:
        violations.append(
            {
                "rule": "TRAVEL_RANGE",
                "message": (
                    f"Distance {offer.distance_km} km exceeds artist travel range of {artist.travel_range_km} km"
                ),
            }
        )

    # 4. MIN_DURATION
    if offer.duration_minutes < artist.min_duration_minutes:
        violations.append(
            {
                "rule": "MIN_DURATION",
                "message": (
                    f"Duration {offer.duration_minutes} mins is below artist minimum of {artist.min_duration_minutes} mins"
                ),
            }
        )

    # 5. GROUP_SIZE
    if offer.group_size > artist.max_group_size:
        violations.append(
            {
                "rule": "GROUP_SIZE",
                "message": (
                    f"Group size {offer.group_size} exceeds artist maximum capacity of {artist.max_group_size}"
                ),
            }
        )

    return ValidationResult(
        passed=len(violations) == 0,
        violations=violations,
    )
