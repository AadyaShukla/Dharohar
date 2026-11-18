"""Negotiation orchestration coordinating organizer and artist agents."""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.agents.artist_agent import run_artist_agent
from backend.agents.llm import LLMRetryExhaustedError
from backend.agents.organizer_agent import run_organizer_agent
from backend.agents.tools import _artist_row_to_dataclass
from backend.audit import log_event
from backend.config import get_settings
from backend.database import ArtistRow, BookingRow, SessionLocal
from backend.rules.compatibility import EventRequest, rank_candidates


def run_negotiation(
    booking_id: str,
    request: Dict[str, Any],
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Coordinate the negotiation workflow between organizer agent and artist agents.

    Workflow:
    1. Organizer agent proposes offers for each requested role.
    2. Each proposed offer is sent to the corresponding artist agent.
    3. Counter-offers from artist agents are evaluated against the total budget.
    4. If every role achieves RECOMMEND_ACCEPT, booking status transitions to
       AWAITING_ARTIST_APPROVAL.

    Never sets status to APPROVED, PAID, or CLOSED.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Step 1: Run Organizer Agent
        organizer_result = run_organizer_agent(booking_id=booking_id, request=request, db=db)
        roles = organizer_result.get("roles", {})

        # Compute total budget
        total_budget = request.get("total_budget")
        if total_budget is None:
            raw_roles = request.get("roles", [])
            total_budget = (
                sum(r.get("budget", 0) for r in raw_roles)
                if raw_roles
                else request.get("budget", 30000)
            )

        roles_outcome: Dict[str, Dict[str, Any]] = {}

        # Step 2: Evaluate offers with Artist Agents
        for role_name, role_info in roles.items():
            art_id = role_info.get("artist_id")
            price = role_info.get("price")
            status = role_info.get("status")

            if status != "VALID" or not art_id or price is None:
                roles_outcome[role_name] = {
                    "artist_id": art_id,
                    "price": price,
                    "status": status,
                    "reasons": role_info.get("reasons", []),
                    "decision": "NO_VALID_OFFER",
                }
                continue

            event_date = request.get("event_date", str(date.today()))
            offer_payload = {
                "price": price,
                "event_date": event_date,
                "distance_km": request.get("distance_km", 100),
                "duration_minutes": request.get("duration_minutes", 60),
                "group_size": request.get("group_size", 6),
            }

            artist_result = run_artist_agent(
                booking_id=booking_id,
                artist_id=art_id,
                offer=offer_payload,
                db=db,
            )

            decision = artist_result["decision"]

            # Step 3: Handle Counters
            if decision == "COUNTER":
                counter_price = artist_result["counter_price"]
                # Calculate new projected total if counter accepted
                other_prices = sum(
                    r.get("price") or 0
                    for r_name, r in roles.items()
                    if r_name != role_name
                )
                if (other_prices + counter_price) <= total_budget:
                    # Organizer accepts the counter within overall budget
                    price = counter_price
                    decision = "RECOMMEND_ACCEPT"
                    reasons = [f"Accepted counter-offer of ₹{counter_price} within total budget."]
                else:
                    decision = "DECLINE"
                    reasons = [
                        f"Counter ₹{counter_price} exceeds available total budget ₹{total_budget}."
                    ]
            else:
                reasons = artist_result.get("reasons", [])

            roles_outcome[role_name] = {
                "artist_id": art_id,
                "price": price,
                "status": "VALID" if decision == "RECOMMEND_ACCEPT" else "DECLINED",
                "decision": decision,
                "reasons": reasons,
                "message": artist_result.get("message", ""),
            }

        # Step 4: Check if every role reached RECOMMEND_ACCEPT
        all_accepted = len(roles_outcome) > 0 and all(
            outcome["decision"] == "RECOMMEND_ACCEPT" for outcome in roles_outcome.values()
        )

        booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()

        # Step 5: Persist standby candidates per role in database
        standby_map: Dict[str, List[Dict[str, Any]]] = {}
        all_artist_rows = (
            db.query(ArtistRow).filter(ArtistRow.listing_status.in_(["LIVE", "TRUSTED"])).all()
        )
        dataclass_artists = [_artist_row_to_dataclass(row) for row in all_artist_rows]

        for role_name, r_outcome in roles_outcome.items():
            primary_art_id = r_outcome.get("artist_id")
            role_cfg = None
            for r in request.get("roles", []):
                if r.get("role") == role_name or r.get("art_form") == role_name:
                    role_cfg = r
                    break

            art_form = (
                (role_cfg.get("art_form") if role_cfg else None)
                or (booking.art_form_requested if booking else "Kalbelia Dance")
            )
            ev_date = request.get("event_date", str(date.today()))
            parsed_date = date.fromisoformat(ev_date) if isinstance(ev_date, str) else ev_date
            role_budget = (
                (role_cfg.get("budget") if role_cfg else None)
                or r_outcome.get("price")
                or 15000
            )
            if role_budget > 100000:
                role_budget = role_budget // 100

            ev_req = EventRequest(
                art_form=art_form,
                event_date=parsed_date,
                price_budget=role_budget,
                distance_km=request.get("distance_km", 100),
                duration_minutes=request.get("duration_minutes", 60),
                group_size=request.get("group_size", 6),
            )

            potential = [a for a in dataclass_artists if a.id != primary_art_id]
            ranked = rank_candidates(ev_req, potential)

            standby_list = []
            for cand in ranked[:3]:
                standby_list.append(
                    {
                        "artist_id": cand.id,
                        "name": cand.name,
                        "art_form": cand.art_form,
                        "min_fee": cand.min_fee,
                        "rating": cand.rating,
                        "status": "STANDBY",
                    }
                )
            standby_map[role_name] = standby_list

        settings = get_settings()
        approval_expiry_hours = getattr(settings, "APPROVAL_EXPIRY_HOURS", 24)

        if all_accepted:
            final_status = "AWAITING_ARTIST_APPROVAL"
            if booking:
                booking.status = final_status
                booking.standby_candidates = standby_map
                booking.approval_expires_at = datetime.utcnow() + timedelta(
                    hours=approval_expiry_hours
                )
                db.commit()
                db.refresh(booking)

                # Issue signed single-use expiring links and notify assigned artists
                try:
                    from backend.notifications.service import notify_offer_awaiting_approval
                    notify_offer_awaiting_approval(booking=booking, roles_outcome=roles_outcome, db=db)
                except Exception as notify_err:
                    pass
        else:
            final_status = booking.status if booking else "NEGOTIATING"
            if booking:
                booking.standby_candidates = standby_map
                db.commit()
                db.refresh(booking)

        return {
            "booking_id": booking_id,
            "status": final_status,
            "all_accepted": all_accepted,
            "roles": roles_outcome,
            "standby_candidates": standby_map,
        }
    except LLMRetryExhaustedError as exc:
        booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first() if db else None
        if booking:
            booking.status = "NEEDS_OPERATOR"
            db.commit()
            db.refresh(booking)

        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="NEGOTIATION_NEEDS_OPERATOR",
            details={
                "error": str(exc),
                "reason": "LLM failed after retries. Operator intervention required.",
            },
            db=db,
        )

        return {
            "booking_id": booking_id,
            "status": "NEEDS_OPERATOR",
            "all_accepted": False,
            "roles": {},
            "error": str(exc),
            "needs_operator": True,
        }
    finally:
        if should_close:
            db.close()
