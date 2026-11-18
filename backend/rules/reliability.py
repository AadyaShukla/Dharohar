"""Reliability scoring and booking completion calculations for Dharohar folk artists.

Computes a deterministic reliability score (0.0 to 100.0) based on completed bookings,
customer ratings, no-shows, and late cancellations.
"""

from __future__ import annotations

from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.database import ArtistRow


def compute_reliability_score(
    completed_bookings: int,
    no_shows: int,
    late_cancels: int,
    ratings_count: int = 0,
    ratings_sum: float = 0.0,
) -> float:
    """Calculate artist reliability score on a 0.0 to 100.0 scale.

    - Base score: 100.0
    - No-shows penalty: -25.0 points per incident
    - Late cancellation penalty: -15.0 points per incident
    - Completed booking bonus: +2.0 points per completion (up to +10.0 above base)
    - Rating factor: If ratings exist, blends 75% behavioral reliability + 25% average rating (scaled to 100)
    """
    base = 100.0
    penalty = (no_shows * 25.0) + (late_cancels * 15.0)
    bonus = min(completed_bookings * 2.0, 10.0)

    score = base - penalty + bonus

    if ratings_count > 0 and ratings_sum > 0:
        avg_rating = ratings_sum / ratings_count  # 1.0 to 5.0
        score = (0.75 * score) + (0.25 * (avg_rating * 20.0))

    return round(max(0.0, min(100.0, score)), 1)


def record_artist_event(
    db: Session,
    artist_id: str,
    event_type: str,
    rating: Optional[float] = None,
) -> ArtistRow:
    """Record an operational lifecycle event for an artist and recalculate their reliability score."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail=f"Artist '{artist_id}' not found.")

    clean_event = event_type.strip().upper()
    if clean_event == "BOOKING_COMPLETED":
        artist.completed_bookings_count += 1
    elif clean_event == "NO_SHOW":
        artist.no_shows_count += 1
    elif clean_event == "LATE_CANCEL":
        artist.late_cancels_count += 1
    elif clean_event == "RATING_RECEIVED":
        if rating is not None and 1.0 <= rating <= 5.0:
            artist.ratings_count += 1
            artist.ratings_sum += rating
            artist.rating = round(artist.ratings_sum / artist.ratings_count, 2)
        else:
            raise HTTPException(
                status_code=400,
                detail="Rating value must be a number between 1.0 and 5.0.",
            )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported event_type '{event_type}'. Supported: BOOKING_COMPLETED, NO_SHOW, LATE_CANCEL, RATING_RECEIVED.",
        )

    # Recalculate score
    artist.reliability_score = compute_reliability_score(
        completed_bookings=artist.completed_bookings_count,
        no_shows=artist.no_shows_count,
        late_cancels=artist.late_cancels_count,
        ratings_count=artist.ratings_count,
        ratings_sum=artist.ratings_sum,
    )

    db.commit()
    db.refresh(artist)
    return artist
