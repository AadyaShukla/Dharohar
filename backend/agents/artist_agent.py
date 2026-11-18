"""Artist agent representing folk artists, providing deterministic offer validation and communication."""

from datetime import date
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.agents.llm import llm_call
from backend.agents.tools import _artist_row_to_dataclass
from backend.audit import log_event
from backend.database import ArtistRow, SessionLocal
from backend.rules.artist_rules import Artist, Offer, validate_offer


def run_artist_agent(
    booking_id: str,
    artist_id: str,
    offer: Dict[str, Any],
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Evaluate an offer on the artist's behalf and generate an artist-facing communication.

    Decision rules (strictly deterministic):
    - validate_offer passes -> RECOMMEND_ACCEPT
    - only MIN_FEE fails -> COUNTER at exactly artist.min_fee
    - any other violation -> DECLINE

    Never returns ACCEPT_FINAL. Final acceptance is a human approval.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        artist_row = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
        if not artist_row:
            return {
                "artist_id": artist_id,
                "decision": "DECLINE",
                "counter_price": None,
                "reasons": [f"Artist {artist_id} not found in database"],
                "message": "Artist profile not found.",
            }

        artist = _artist_row_to_dataclass(artist_row)

        parsed_date = (
            date.fromisoformat(offer["event_date"])
            if isinstance(offer["event_date"], str)
            else offer["event_date"]
        )

        offer_obj = Offer(
            artist_id=artist_id,
            price=offer["price"],
            event_date=parsed_date,
            distance_km=offer.get("distance_km", 100),
            duration_minutes=offer.get("duration_minutes", 60),
            group_size=offer.get("group_size", 6),
        )

        # 1. Deterministic Rule Evaluation
        validation = validate_offer(artist, offer_obj)

        if validation.passed:
            decision = "RECOMMEND_ACCEPT"
            counter_price = None
            reasons = []
            audit_action = "OFFER_ACCEPTED"
        elif len(validation.violations) == 1 and validation.violations[0]["rule"] == "MIN_FEE":
            decision = "COUNTER"
            counter_price = artist.min_fee
            reasons = [
                f"Offered ₹{offer['price']} is below minimum fee of ₹{artist.min_fee}. Countering at ₹{artist.min_fee}."
            ]
            audit_action = "OFFER_PROPOSED"
        else:
            decision = "DECLINE"
            counter_price = None
            reasons = [v["message"] for v in validation.violations]
            audit_action = "OFFER_REJECTED"

        # 2. LLM call ONLY for generating plain language message in artist's preferred language
        pref_language = "Hindi" if "Hindi" in (artist.languages or []) else "English"
        system_prompt = (
            "You are an assistant communicating with Indian folk artists. "
            "Write a brief, polite 1-sentence message explaining the offer status."
        )
        messages = [
            {
                "role": "user",
                "content": (
                    f"Artist: {artist.name}\n"
                    f"Language: {pref_language}\n"
                    f"Proposed fee: ₹{offer['price']}\n"
                    f"Decision recommendation: {decision}\n"
                    f"Counter price (if any): ₹{counter_price}\n"
                    "Write a short, clear message for the artist."
                ),
            }
        ]

        try:
            llm_response = llm_call(system_prompt=system_prompt, messages=messages)
            artist_message = llm_response.get("text") or f"Offer received: {decision}."
        except Exception:
            # Fallback message if LLM is unavailable or unscripted
            if decision == "RECOMMEND_ACCEPT":
                artist_message = (
                    f"नमस्ते {artist.name}, ₹{offer['price']} का प्रस्ताव आपके नियमों के अनुसार सही है। स्वीकृति की सिफारिश की जाती है।"
                    if pref_language == "Hindi"
                    else f"Hello {artist.name}, the offer of ₹{offer['price']} meets all terms and is recommended for approval."
                )
            elif decision == "COUNTER":
                artist_message = (
                    f"नमस्ते {artist.name}, ₹{offer['price']} का प्रस्ताव कम है। हमने ₹{counter_price} का जवाबी प्रस्ताव दिया है।"
                    if pref_language == "Hindi"
                    else f"Hello {artist.name}, the offer of ₹{offer['price']} is below minimum. We countered at ₹{counter_price}."
                )
            else:
                artist_message = (
                    f"नमस्ते {artist.name}, यह प्रस्ताव आपकी शर्तों से मेल नहीं खाता है।"
                    if pref_language == "Hindi"
                    else f"Hello {artist.name}, this offer does not match your availability and terms."
                )

        # 3. Log to audit log with actor ARTIST_AGENT
        log_event(
            booking_id=booking_id,
            actor="ARTIST_AGENT",
            action=audit_action,
            details={
                "artist_id": artist_id,
                "decision": decision,
                "counter_price": counter_price,
                "reasons": reasons,
                "artist_message": artist_message,
            },
            db=db,
        )

        return {
            "artist_id": artist_id,
            "decision": decision,
            "counter_price": counter_price,
            "reasons": reasons,
            "message": artist_message,
        }
    finally:
        if should_close:
            db.close()
