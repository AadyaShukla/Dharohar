"""Agent tool definitions and registry. All offer interactions enforce rules and audit logging."""

from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.database import ArtistRow, BookingRow, SessionLocal
from backend.rules.artist_rules import Artist, Offer, validate_offer
from backend.rules.compatibility import EventRequest, check_standby, rank_candidates


def _artist_row_to_dataclass(row: ArtistRow) -> Artist:
    """Convert an ArtistRow database model to an Artist dataclass."""
    blackout_dates = []
    for d in row.blackout_dates or []:
        if isinstance(d, str):
            blackout_dates.append(date.fromisoformat(d))
        elif isinstance(d, date):
            blackout_dates.append(d)

    return Artist(
        id=row.id,
        name=row.name,
        art_form=row.art_form,
        city=row.city,
        min_fee=row.min_fee,
        blackout_dates=blackout_dates,
        travel_range_km=row.travel_range_km,
        min_duration_minutes=row.min_duration_minutes,
        max_group_size=row.max_group_size,
        rating=row.rating,
        languages=row.languages or [],
    )


# ---------------------------------------------------------------------------
# Tool Implementations
# ---------------------------------------------------------------------------


def search_artists(
    art_form: str,
    event_date: str,
    max_distance_km: int,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Search for folk artists not on a blackout date, matching art form and travel range."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        query_date = (
            date.fromisoformat(event_date) if isinstance(event_date, str) else event_date
        )
        date_str = query_date.isoformat()

        all_artists = db.query(ArtistRow).all()
        results = []

        for row in all_artists:
            # Check blackout dates
            if date_str in (row.blackout_dates or []):
                continue

            # Check travel range
            if max_distance_km > row.travel_range_km:
                continue

            # Check art form match (case-insensitive substring or match)
            if art_form.strip().lower() not in row.art_form.strip().lower():
                continue

            results.append(
                {
                    "id": row.id,
                    "name": row.name,
                    "art_form": row.art_form,
                    "min_fee": row.min_fee,
                    "rating": row.rating,
                }
            )

        return results
    finally:
        if should_close:
            db.close()


def propose_offer(
    booking_id: str,
    artist_id: str,
    price: int,
    event_date: str,
    distance_km: int,
    duration_minutes: int,
    group_size: int,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Evaluate an offer via the rules engine and log OFFER_PROPOSED or OFFER_REJECTED.

    Never confirms a booking or approves on behalf of an artist.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Normalize price to integer paise if passed in INR
        if price is not None and price < 100000:
            price = int(price * 100)

        artist_row = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
        if not artist_row:
            return {
                "valid": False,
                "error": f"Artist '{artist_id}' not found.",
                "violations": [{"rule": "NOT_FOUND", "message": f"Artist {artist_id} does not exist"}],
            }

        artist = _artist_row_to_dataclass(artist_row)
        parsed_date = (
            date.fromisoformat(event_date) if isinstance(event_date, str) else event_date
        )

        offer = Offer(
            artist_id=artist_id,
            price=price,
            event_date=parsed_date,
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            group_size=group_size,
        )

        validation = validate_offer(artist, offer)

        if not validation.passed:
            log_event(
                booking_id=booking_id,
                actor="RULES_ENGINE",
                action="OFFER_REJECTED",
                details={
                    "artist_id": artist_id,
                    "price": price,
                    "violations": validation.violations,
                },
                db=db,
            )
            return {
                "valid": False,
                "status": "REJECTED",
                "violations": validation.violations,
            }

        # Offer passed rules -> log OFFER_PROPOSED
        log_event(
            booking_id=booking_id,
            actor="ORGANIZER_AGENT",
            action="OFFER_PROPOSED",
            details={
                "artist_id": artist_id,
                "price": price,
                "event_date": parsed_date.isoformat(),
                "distance_km": distance_km,
                "duration_minutes": duration_minutes,
                "group_size": group_size,
            },
            db=db,
        )

        return {
            "valid": True,
            "status": "PROPOSED",
            "offer": {
                "artist_id": artist_id,
                "price": price,
                "event_date": parsed_date.isoformat(),
                "distance_km": distance_km,
                "duration_minutes": duration_minutes,
                "group_size": group_size,
            },
        }
    finally:
        if should_close:
            db.close()


def check_standby_candidate(
    booking_id: str,
    candidate_artist_id: str,
    offered_price: int,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Evaluate candidate compatibility as a standby replacement and log STANDBY_CHECKED."""
    # Normalize offered_price to integer paise if passed in INR
    if offered_price is not None and offered_price < 100000:
        offered_price = int(offered_price * 100)

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
        if not booking:
            # Fallback values if booking row is missing in simulated context
            art_form_requested = "Folk Performance"
            event_date = date.today()
            budget = offered_price
        else:
            art_form_requested = booking.art_form_requested
            event_date = booking.event_date
            budget = booking.budget

        candidate_row = (
            db.query(ArtistRow).filter(ArtistRow.id == candidate_artist_id).first()
        )
        if not candidate_row:
            return {
                "eligible": False,
                "error": f"Candidate artist '{candidate_artist_id}' not found.",
                "hard_failures": [{"rule": "NOT_FOUND", "message": "Candidate not found"}],
                "soft_scores": {},
                "needs_organizer_approval": False,
                "approval_reasons": [],
            }

        candidate = _artist_row_to_dataclass(candidate_row)

        request = EventRequest(
            art_form=art_form_requested,
            event_date=event_date,
            price_budget=budget,
            distance_km=100,  # Standard simulated distance
            duration_minutes=candidate.min_duration_minutes,
            group_size=min(6, candidate.max_group_size),
        )

        result = check_standby(request, candidate, offered_price=offered_price)

        log_event(
            booking_id=booking_id,
            actor="RULES_ENGINE",
            action="STANDBY_CHECKED",
            details={
                "candidate_artist_id": candidate_artist_id,
                "offered_price": offered_price,
                "eligible": result.eligible,
                "needs_organizer_approval": result.needs_organizer_approval,
                "approval_reasons": result.approval_reasons,
            },
            db=db,
        )

        return {
            "eligible": result.eligible,
            "hard_failures": result.hard_failures,
            "soft_scores": result.soft_scores,
            "needs_organizer_approval": result.needs_organizer_approval,
            "approval_reasons": result.approval_reasons,
        }
    finally:
        if should_close:
            db.close()


def list_standby_candidates(
    booking_id: str,
    db: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Return standby candidates ranked by rank_candidates for a booking."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
        if not booking:
            return []

        all_artist_rows = db.query(ArtistRow).all()
        artists = [_artist_row_to_dataclass(row) for row in all_artist_rows]

        request = EventRequest(
            art_form=booking.art_form_requested,
            event_date=booking.event_date,
            price_budget=booking.budget,
            distance_km=100,
            duration_minutes=60,
            group_size=6,
        )

        ranked = rank_candidates(request, artists)

        return [
            {
                "id": a.id,
                "name": a.name,
                "art_form": a.art_form,
                "min_fee": a.min_fee,
                "rating": a.rating,
            }
            for a in ranked
        ]
    finally:
        if should_close:
            db.close()


# ---------------------------------------------------------------------------
# Tool Registry and Schemas
# ---------------------------------------------------------------------------

TOOL_REGISTRY = {
    "search_artists": search_artists,
    "propose_offer": propose_offer,
    "check_standby_candidate": check_standby_candidate,
    "list_standby_candidates": list_standby_candidates,
}

TOOL_SCHEMAS = [
    {
        "name": "search_artists",
        "description": "Search for folk artists not on a blackout date, matching art form and travel range.",
        "parameters": {
            "type": "object",
            "properties": {
                "art_form": {
                    "type": "string",
                    "description": "Folk art form to search for (e.g. Kalbelia Dance, Manganiyar Folk Music)",
                },
                "event_date": {
                    "type": "string",
                    "description": "ISO date string YYYY-MM-DD for the proposed event",
                },
                "max_distance_km": {
                    "type": "integer",
                    "description": "Maximum event travel distance in kilometers",
                },
            },
            "required": ["art_form", "event_date", "max_distance_km"],
        },
    },
    {
        "name": "propose_offer",
        "description": "Propose an offer for an artist. Validates against artist rules and logs to audit. Never approves a booking.",
        "parameters": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "string", "description": "Unique booking identifier"},
                "artist_id": {"type": "string", "description": "ID of the artist receiving the offer"},
                "price": {"type": "integer", "description": "Offered fee in INR"},
                "event_date": {"type": "string", "description": "ISO date string YYYY-MM-DD"},
                "distance_km": {"type": "integer", "description": "Distance to event location in km"},
                "duration_minutes": {"type": "integer", "description": "Duration of performance in minutes"},
                "group_size": {"type": "integer", "description": "Number of audience / troupe attendees"},
            },
            "required": [
                "booking_id",
                "artist_id",
                "price",
                "event_date",
                "distance_km",
                "duration_minutes",
                "group_size",
            ],
        },
    },
    {
        "name": "check_standby_candidate",
        "description": "Evaluate standby compatibility of a replacement artist for a booking and log to audit.",
        "parameters": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "string", "description": "Booking ID needing replacement"},
                "candidate_artist_id": {
                    "type": "string",
                    "description": "Candidate artist ID to check for compatibility",
                },
                "offered_price": {"type": "integer", "description": "Offered replacement price in INR"},
            },
            "required": ["booking_id", "candidate_artist_id", "offered_price"],
        },
    },
    {
        "name": "list_standby_candidates",
        "description": "List and rank available replacement standby artists for an existing booking.",
        "parameters": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "string", "description": "Booking ID to find standbys for"}
            },
            "required": ["booking_id"],
        },
    },
]


def get_tool_schemas() -> List[Dict[str, Any]]:
    """Return JSON schemas for all available agent tools."""
    return TOOL_SCHEMAS


def execute_tool(name: str, arguments: Dict[str, Any], db: Optional[Session] = None) -> Any:
    """Execute a registered agent tool by name with provided arguments."""
    if name not in TOOL_REGISTRY:
        raise ValueError(f"Tool '{name}' is not registered in Dharohar agents tool registry.")

    func = TOOL_REGISTRY[name]
    # Pass db if accepted by func
    if "db" in func.__code__.co_varnames:
        return func(**arguments, db=db)
    return func(**arguments)
