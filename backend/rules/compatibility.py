"""Replacement compatibility engine for evaluating and ranking standby artist candidates."""

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional, Union

from backend.rules.artist_rules import Artist, Offer, validate_offer


@dataclass
class EventRequest:
    """Organizer request specifying booking requirements and constraints."""

    art_form: str
    event_date: date
    price_budget: int  # in INR
    distance_km: int
    duration_minutes: int
    group_size: int
    language: Optional[str] = None


@dataclass
class CompatibilityResult:
    """Outcome of evaluating candidate compatibility for an event request."""

    eligible: bool
    hard_failures: List[Dict[str, str]]
    soft_scores: Dict[str, Any]
    needs_organizer_approval: bool
    approval_reasons: List[str]


def check_standby(
    request: EventRequest,
    candidate: Artist,
    offered_price: int,
    price_tolerance_pct: float = 10.0,
) -> CompatibilityResult:
    """Evaluate candidate suitability as a standby/replacement for an event request.

    Hard checks:
    - Candidate availability (not on a blackout date)
    - Travel range
    - Minimum fee (offered_price >= candidate.min_fee)
    - Minimum duration (request.duration_minutes >= candidate.min_duration_minutes)
    - Group size (request.group_size <= candidate.max_group_size)

    Approval triggers:
    - DIFFERENT_ART_FORM: candidate.art_form differs from request.art_form
    - PRICE_ABOVE_TOLERANCE: offered_price exceeds budget by > price_tolerance_pct
    - DIFFERENT_DURATION: candidate's duration differs from request.duration_minutes
    """
    # 1. Hard checks via validate_offer
    offer = Offer(
        artist_id=candidate.id,
        price=offered_price,
        event_date=request.event_date,
        distance_km=request.distance_km,
        duration_minutes=request.duration_minutes,
        group_size=request.group_size,
    )
    validation = validate_offer(candidate, offer)
    eligible = validation.passed
    hard_failures = validation.violations

    # 2. Soft scores calculation
    price_difference_inr = offered_price - request.price_budget
    if request.price_budget > 0:
        price_difference_pct = (price_difference_inr / request.price_budget) * 100.0
    else:
        price_difference_pct = 0.0

    if request.language:
        language_match = any(
            request.language.strip().lower() == lang.strip().lower()
            for lang in candidate.languages
        )
    else:
        language_match = True

    soft_scores: Dict[str, Any] = {
        "price_difference_inr": price_difference_inr,
        "price_difference_pct": round(price_difference_pct, 2),
        "distance_km": request.distance_km,
        "rating": candidate.rating,
        "language_match": language_match,
    }

    # 3. Approval reasons
    approval_reasons: List[str] = []

    # Art form rule (different art form is not a hard failure, but needs approval)
    if candidate.art_form != request.art_form:
        approval_reasons.append("DIFFERENT_ART_FORM")

    # Price tolerance rule
    if price_difference_pct > price_tolerance_pct:
        approval_reasons.append("PRICE_ABOVE_TOLERANCE")

    # Duration rule (candidate duration differs from request)
    candidate_duration = getattr(
        candidate, "duration_minutes", getattr(candidate, "min_duration_minutes", None)
    )
    if candidate_duration is not None and candidate_duration != request.duration_minutes:
        approval_reasons.append("DIFFERENT_DURATION")

    needs_organizer_approval = len(approval_reasons) > 0

    return CompatibilityResult(
        eligible=eligible,
        hard_failures=hard_failures,
        soft_scores=soft_scores,
        needs_organizer_approval=needs_organizer_approval,
        approval_reasons=approval_reasons,
    )


def rank_candidates(
    request: EventRequest,
    candidates: List[Union[Artist, Any]],
    offered_price: Optional[int] = None,
    price_tolerance_pct: float = 10.0,
) -> List[Artist]:
    """Return eligible candidates sorted by:
    1. No organizer approval needed first
    2. Smaller price difference
    3. Higher rating
    """
    evaluated: List[tuple[Artist, CompatibilityResult]] = []

    for item in candidates:
        if isinstance(item, tuple):
            candidate, price = item
        else:
            candidate = item
            price = offered_price if offered_price is not None else candidate.min_fee

        result = check_standby(
            request=request,
            candidate=candidate,
            offered_price=price,
            price_tolerance_pct=price_tolerance_pct,
        )

        if result.eligible:
            evaluated.append((candidate, result))

    # Sort key:
    # 1. needs_organizer_approval (False before True)
    # 2. price_difference_inr (ascending)
    # 3. rating (descending -> -rating)
    evaluated.sort(
        key=lambda pair: (
            pair[1].needs_organizer_approval,
            pair[1].soft_scores["price_difference_inr"],
            -pair[0].rating,
        )
    )

    return [pair[0] for pair in evaluated]
