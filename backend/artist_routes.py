"""Artist profiles, onboarding wizard, coordinator vouches, operator review queue, and rules endpoints.

Implements role-based access control, file upload validation, live challenge prompts,
and strict listing-status gates.
"""

from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List, Optional
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.auth import get_current_user, require_role
from backend.crypto import decrypt_sensitive, encrypt_sensitive, mask_upi_id
from backend.database import (
    ArtistRow,
    AuditLogRow,
    CoordinatorVouchRow,
    UserRow,
    get_db,
)
from backend.rules.reliability import compute_reliability_score, record_artist_event
from backend.storage import (
    generate_live_prompt,
    upload_file_to_storage,
)

artist_router = APIRouter(tags=["artists"])

# Controlled list of authentic folk art forms
CONTROLLED_ART_FORMS = [
    "Kalbelia Dance",
    "Ghoomar Dance",
    "Bhavai Folk Dance",
    "Chhau Dance",
    "Manganiyar Folk Music",
    "Pandavani Ballad",
    "Kathputli Puppet Theatre",
    "Tholu Bommalata Shadow Puppetry",
    "Blue Pottery Craft Demonstration",
    "Pabuji Ki Phad",
    "Baul Sangeet",
    "Bhangra & Giddha",
    "Lavani Dance",
    "Yakshagana",
    "Gotipua Dance",
    "Other",
]


def log_audit(
    db: Session,
    action: str,
    details: Dict[str, Any],
    actor: str = "ARTIST",
    booking_id: Optional[str] = None,
) -> AuditLogRow:
    """Helper to record immutable audit log entries."""
    row = AuditLogRow(
        booking_id=booking_id,
        actor=actor,
        action=action,
        details=details,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_own_artist(current_user: UserRow, db: Session) -> ArtistRow:
    """Retrieve the ArtistRow owned by current_user. Raises 404 or 403 if not found or unauthorized."""
    if current_user.role != "ARTIST":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only artist accounts can access own artist profile.",
        )
    if not current_user.artist_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artist profile has not been created yet. Please complete onboarding first.",
        )
    artist = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
    if not artist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Artist profile '{current_user.artist_id}' not found.",
        )
    return artist


# -----------------------------------------------------------------------------
# Request Models
# -----------------------------------------------------------------------------

class ArtistProfileCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    art_form: str = Field(..., min_length=2, max_length=100)
    city: str = Field(..., min_length=2, max_length=80)
    state: str = Field("Rajasthan", min_length=2, max_length=80)
    bio: Optional[str] = Field("", max_length=2000)
    languages: List[str] = Field(default_factory=lambda: ["Hindi"])
    years_experience: int = Field(1, ge=0, le=70)
    group_size: int = Field(1, ge=1, le=200)
    equipment_needed: Optional[str] = Field("", max_length=1000)
    min_fee: int = Field(..., ge=500, description="Minimum fee in INR")
    travel_range_km: int = Field(100, ge=0, le=2000)
    min_duration_minutes: int = Field(60, ge=15, le=480)
    max_group_size: int = Field(10, ge=1, le=200)
    upi_id: Optional[str] = Field(None, max_length=100)


class ArtistRulesUpdateRequest(BaseModel):
    min_fee: int = Field(..., ge=500, description="Minimum fee in INR")
    travel_range_km: int = Field(..., ge=0, le=2000)
    min_duration_minutes: int = Field(..., ge=15, le=480)
    max_group_size: int = Field(..., ge=1, le=200)


class ArtistAvailabilityUpdateRequest(BaseModel):
    blackout_dates: List[str] = Field(default_factory=list, description="ISO dates YYYY-MM-DD")
    recurring_unavailable_days: List[str] = Field(
        default_factory=list,
        description="e.g. ['Monday', 'Friday']",
    )


class PayoutUpdateRequest(BaseModel):
    upi_id: str = Field(..., min_length=3, max_length=100)


class VouchRequest(BaseModel):
    notes: str = Field(..., min_length=5, max_length=1500)


class OperatorReviewRequest(BaseModel):
    action: str = Field(..., description="'approve' or 'reject'")
    reason: Optional[str] = Field("", max_length=1000)


class EventTriggerRequest(BaseModel):
    event_type: str = Field(..., description="BOOKING_COMPLETED | NO_SHOW | LATE_CANCEL | RATING_RECEIVED")
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)


# -----------------------------------------------------------------------------
# Static Discovery & Shared Helper Routes (Must precede /{artist_id})
# -----------------------------------------------------------------------------

@artist_router.get("/artists/forms")
def list_controlled_art_forms() -> List[str]:
    """Retrieve controlled list of authentic traditional Indian folk art forms."""
    return CONTROLLED_ART_FORMS


@artist_router.get("/artists/live-prompt")
def get_live_prompt(
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Issue a fresh random challenge phrase for the artist to recite at the start of audition video."""
    phrase = generate_live_prompt()
    if current_user.artist_id:
        artist = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
        if artist:
            artist.live_prompt_phrase = phrase
            db.commit()

    return {
        "prompt_phrase": phrase,
        "instructions": "Recite this exact phrase clearly on camera during the first 5 seconds of your audition video.",
    }


# -----------------------------------------------------------------------------
# Artist Own Profile & Rules Routes (Role: ARTIST, Own Record Only)
# -----------------------------------------------------------------------------

@artist_router.get("/artists/me/profile")
def get_my_artist_profile(
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the authenticated artist's own full profile with unmasked UPI ID."""
    if not current_user.artist_id:
        return {
            "is_onboarded": False,
            "user_id": current_user.id,
            "name": current_user.name,
            "phone": current_user.phone,
        }

    artist = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
    if not artist:
        return {
            "is_onboarded": False,
            "user_id": current_user.id,
            "name": current_user.name,
            "phone": current_user.phone,
        }

    data = artist.to_dict(show_sensitive=True)
    data["is_onboarded"] = True

    # Include vouches info
    vouches = db.query(CoordinatorVouchRow).filter(CoordinatorVouchRow.artist_id == artist.id).all()
    data["vouches_count"] = len(vouches)
    data["vouches"] = [v.to_dict() for v in vouches]
    return data


@artist_router.post("/artists/profile")
def create_artist_profile(
    payload: ArtistProfileCreateRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create or initialize an artist profile for the authenticated artist."""
    if current_user.artist_id:
        existing = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Artist profile already exists. Use PUT /artists/me/profile to update.",
            )

    artist_id = f"artist_{uuid.uuid4().hex[:10]}"
    encrypted_upi = encrypt_sensitive(payload.upi_id) if payload.upi_id else None

    # Enforce minimum fee converted to integer paise
    min_fee_paise = int(payload.min_fee * 100)

    new_artist = ArtistRow(
        id=artist_id,
        name=payload.name.strip(),
        art_form=payload.art_form.strip(),
        city=payload.city.strip(),
        state=payload.state.strip(),
        bio=payload.bio.strip() if payload.bio else "",
        languages=payload.languages or ["Hindi"],
        years_experience=payload.years_experience,
        group_size=payload.group_size,
        equipment_needed=payload.equipment_needed.strip() if payload.equipment_needed else "",
        min_fee=min_fee_paise,
        travel_range_km=payload.travel_range_km,
        min_duration_minutes=payload.min_duration_minutes,
        max_group_size=payload.max_group_size,
        blackout_dates=[],
        recurring_unavailable_days=[],
        photo_urls=[],
        video_urls=[],
        upi_id=encrypted_upi,
        payout_account_status="ACTIVE" if payload.upi_id else "PENDING_VERIFICATION",
        verification_stage="REGISTERED",
        listing_status="DRAFT",
        reliability_score=100.0,
        completed_bookings_count=0,
    )

    db.add(new_artist)
    current_user.artist_id = artist_id
    db.commit()
    db.refresh(new_artist)

    log_audit(
        db,
        action="ARTIST_PROFILE_CREATED",
        details={
            "artist_id": new_artist.id,
            "user_id": current_user.id,
            "name": new_artist.name,
            "art_form": new_artist.art_form,
        },
        actor="ARTIST",
    )

    return new_artist.to_dict(show_sensitive=True)


@artist_router.put("/artists/me/profile")
def update_my_artist_profile(
    payload: ArtistProfileCreateRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update general profile information for the authenticated artist."""
    artist = get_own_artist(current_user, db)

    artist.name = payload.name.strip()
    artist.art_form = payload.art_form.strip()
    artist.city = payload.city.strip()
    artist.state = payload.state.strip()
    artist.bio = payload.bio.strip() if payload.bio else ""
    artist.languages = payload.languages or ["Hindi"]
    artist.years_experience = payload.years_experience
    artist.group_size = payload.group_size
    artist.equipment_needed = payload.equipment_needed.strip() if payload.equipment_needed else ""
    artist.min_fee = int(payload.min_fee * 100)
    artist.travel_range_km = payload.travel_range_km
    artist.min_duration_minutes = payload.min_duration_minutes
    artist.max_group_size = payload.max_group_size

    if payload.upi_id:
        artist.upi_id = encrypt_sensitive(payload.upi_id.strip())
        artist.payout_account_status = "ACTIVE"

    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="ARTIST_PROFILE_UPDATED",
        details={"artist_id": artist.id, "user_id": current_user.id},
        actor="ARTIST",
    )

    return artist.to_dict(show_sensitive=True)


@artist_router.put("/artists/me/rules")
def update_my_artist_rules(
    payload: ArtistRulesUpdateRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update operational rules (min fee, travel range, duration, group size). Changes are audit-logged."""
    artist = get_own_artist(current_user, db)

    before = {
        "min_fee": artist.min_fee // 100,
        "travel_range_km": artist.travel_range_km,
        "min_duration_minutes": artist.min_duration_minutes,
        "max_group_size": artist.max_group_size,
    }

    artist.min_fee = int(payload.min_fee * 100)
    artist.travel_range_km = payload.travel_range_km
    artist.min_duration_minutes = payload.min_duration_minutes
    artist.max_group_size = payload.max_group_size

    db.commit()
    db.refresh(artist)

    after = {
        "min_fee": artist.min_fee // 100,
        "travel_range_km": artist.travel_range_km,
        "min_duration_minutes": artist.min_duration_minutes,
        "max_group_size": artist.max_group_size,
    }

    log_audit(
        db,
        action="ARTIST_RULES_UPDATED",
        details={
            "artist_id": artist.id,
            "user_id": current_user.id,
            "before": before,
            "after": after,
        },
        actor="ARTIST",
    )

    return {
        "status": "ok",
        "message": "Artist performance rules updated successfully.",
        "rules": after,
    }


@artist_router.put("/artists/me/availability")
def update_my_availability(
    payload: ArtistAvailabilityUpdateRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update availability calendar (blackout dates & recurring unavailable days). Changes are audit-logged."""
    artist = get_own_artist(current_user, db)

    # Validate ISO date format YYYY-MM-DD
    valid_dates = []
    iso_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    for d in payload.blackout_dates:
        clean_d = d.strip()
        if iso_regex.match(clean_d):
            valid_dates.append(clean_d)

    artist.blackout_dates = sorted(list(set(valid_dates)))
    artist.recurring_unavailable_days = [
        day.strip().capitalize() for day in payload.recurring_unavailable_days if day.strip()
    ]

    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="AVAILABILITY_CALENDAR_UPDATED",
        details={
            "artist_id": artist.id,
            "user_id": current_user.id,
            "blackout_dates_count": len(artist.blackout_dates),
            "recurring_days": artist.recurring_unavailable_days,
        },
        actor="ARTIST",
    )

    return {
        "status": "ok",
        "message": "Availability calendar updated successfully.",
        "blackout_dates": artist.blackout_dates,
        "recurring_unavailable_days": artist.recurring_unavailable_days,
    }


@artist_router.post("/artists/upload-audition")
async def upload_audition_video(
    file: UploadFile = File(...),
    live_prompt: Optional[str] = Form(None),
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upload audition video to object storage (MP4 only, max 100MB). Stores URL with live prompt."""
    artist = get_own_artist(current_user, db)

    public_url, filename = await upload_file_to_storage(file, is_video=True)

    # Append to video URLs
    current_videos = list(artist.video_urls or [])
    current_videos.append(public_url)
    artist.video_urls = current_videos

    if live_prompt:
        artist.live_prompt_phrase = live_prompt.strip()

    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="ARTIST_AUDITION_VIDEO_UPLOADED",
        details={
            "artist_id": artist.id,
            "filename": filename,
            "video_url": public_url,
            "live_prompt": artist.live_prompt_phrase,
        },
        actor="ARTIST",
    )

    return {
        "status": "ok",
        "video_url": public_url,
        "live_prompt": artist.live_prompt_phrase,
        "total_videos": len(artist.video_urls),
    }


@artist_router.post("/artists/upload-photo")
async def upload_portfolio_photo(
    file: UploadFile = File(...),
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Upload portfolio performance photo (JPG/PNG/WEBP, max 10MB)."""
    artist = get_own_artist(current_user, db)

    public_url, filename = await upload_file_to_storage(file, is_video=False)

    current_photos = list(artist.photo_urls or [])
    current_photos.append(public_url)
    artist.photo_urls = current_photos

    db.commit()
    db.refresh(artist)

    return {
        "status": "ok",
        "photo_url": public_url,
        "total_photos": len(artist.photo_urls),
    }


@artist_router.put("/artists/me/payout")
def update_payout_details(
    payload: PayoutUpdateRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Store encrypted UPI ID at rest, create Razorpay Route linked account if enabled, and update payout status."""
    from backend.trustpay import get_payment_provider, RazorpayProvider
    artist = get_own_artist(current_user, db)

    clean_upi = payload.upi_id.strip()
    if "@" not in clean_upi:
        raise HTTPException(
            status_code=400,
            detail="Invalid UPI ID format. Expected format: handle@bank (e.g. 9876543210@okhdfcbank).",
        )

    artist.upi_id = encrypt_sensitive(clean_upi)

    # Attempt to create Razorpay Route linked account
    provider = get_payment_provider()
    route_enabled = False
    linked_account_id = None
    if isinstance(provider, RazorpayProvider):
        route_res = provider.create_linked_account(
            artist_id=artist.id,
            artist_name=artist.name,
            email="",
            phone=current_user.phone or "",
            upi_id=clean_upi,
        )
        if route_res.get("success"):
            route_enabled = True
            linked_account_id = route_res.get("linked_account_id")
            artist.linked_account_id = linked_account_id
            artist.payout_account_status = "ACTIVE"
        else:
            artist.linked_account_id = None
            artist.payout_account_status = "ACTIVE"
    else:
        artist.payout_account_status = "ACTIVE"

    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="ARTIST_PAYOUT_UPDATED",
        details={
            "artist_id": artist.id,
            "masked_upi": mask_upi_id(clean_upi),
            "linked_account_id": linked_account_id,
            "route_enabled": route_enabled,
        },
        actor="ARTIST",
    )

    return {
        "status": "ok",
        "message": "Payout account details saved securely.",
        "masked_upi_id": mask_upi_id(clean_upi),
        "linked_account_id": linked_account_id,
        "route_enabled": route_enabled,
        "payout_account_status": artist.payout_account_status,
    }


@artist_router.post("/artists/me/submit-for-review")
def submit_artist_for_review(
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Submit artist profile for operator verification. Transitions listing_status to PENDING_REVIEW."""
    artist = get_own_artist(current_user, db)

    # Verification prerequisites
    missing = []
    if not artist.bio or len(artist.bio.strip()) < 10:
        missing.append("Detailed bio description (at least 10 characters)")
    if not artist.video_urls or len(artist.video_urls) == 0:
        missing.append("At least one audition video (.mp4)")
    if not artist.upi_id:
        missing.append("Payout UPI ID")

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit for review. Missing requirements: {'; '.join(missing)}.",
        )

    artist.listing_status = "PENDING_REVIEW"
    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="ARTIST_SUBMITTED_FOR_REVIEW",
        details={"artist_id": artist.id, "user_id": current_user.id},
        actor="ARTIST",
    )

    return {
        "status": "ok",
        "message": "Artist profile submitted for review. An operator will review your audition video shortly.",
        "listing_status": artist.listing_status,
        "verification_stage": artist.verification_stage,
    }


# -----------------------------------------------------------------------------
# Coordinator Vouching Endpoints (Role: COORDINATOR)
# -----------------------------------------------------------------------------

@artist_router.get("/coordinator/artists")
def list_artists_for_coordinator(
    current_user: UserRow = Depends(require_role("COORDINATOR", "OPERATOR")),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List artists eligible for cultural coordinator vouching."""
    artists = db.query(ArtistRow).order_by(ArtistRow.name.asc()).all()
    results = []
    for a in artists:
        vouches = db.query(CoordinatorVouchRow).filter(CoordinatorVouchRow.artist_id == a.id).all()
        has_my_vouch = any(v.coordinator_id == current_user.id for v in vouches)
        dict_rep = a.to_dict(show_sensitive=False)
        dict_rep["vouches_count"] = len(vouches)
        dict_rep["vouched_by_me"] = has_my_vouch
        results.append(dict_rep)
    return results


# -----------------------------------------------------------------------------
# Operator Review Queue (Role: OPERATOR)
# -----------------------------------------------------------------------------

@artist_router.get("/operator/review-queue")
def get_operator_review_queue(
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve queue of folk artists awaiting video review (listing_status=PENDING_REVIEW)."""
    pending = (
        db.query(ArtistRow)
        .filter(ArtistRow.listing_status == "PENDING_REVIEW")
        .order_by(ArtistRow.updated_at.asc())
        .all()
    )

    out = []
    for a in pending:
        data = a.to_dict(show_sensitive=False)
        vouches = db.query(CoordinatorVouchRow).filter(CoordinatorVouchRow.artist_id == a.id).all()
        data["vouches_count"] = len(vouches)
        data["vouches"] = [v.to_dict() for v in vouches]
        out.append(data)
    return out


# -----------------------------------------------------------------------------
# Parameterized /artists/{artist_id} Routes (Must come after static routes)
# -----------------------------------------------------------------------------

@artist_router.post("/operator/artists/{artist_id}/review")
def review_artist_submission(
    artist_id: str,
    payload: OperatorReviewRequest,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Approve or reject an artist submission. Listing becomes LIVE only after video review approval."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail=f"Artist '{artist_id}' not found.")

    action = payload.action.strip().lower()
    if action not in ["approve", "reject"]:
        raise HTTPException(
            status_code=400,
            detail="Action must be either 'approve' or 'reject'.",
        )

    if action == "approve":
        # Enforce prerequisite: must have audition video
        if not artist.video_urls or len(artist.video_urls) == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot approve artist without an audition video.",
            )

        # Listing becomes LIVE only after video review approval
        artist.listing_status = "LIVE"

        # Check coordinator vouches count: >=2 vouches elevates directly to TRUSTED
        vouches_count = (
            db.query(CoordinatorVouchRow)
            .filter(CoordinatorVouchRow.artist_id == artist_id)
            .count()
        )
        if vouches_count >= 2:
            artist.verification_stage = "TRUSTED"
        else:
            artist.verification_stage = "VIDEO_REVIEWED"

        db.commit()
        db.refresh(artist)

        log_audit(
            db,
            action="ARTIST_REVIEW_APPROVED",
            details={
                "artist_id": artist.id,
                "operator_id": current_user.id,
                "reason": payload.reason,
                "listing_status": artist.listing_status,
                "verification_stage": artist.verification_stage,
            },
            actor="OPERATOR",
        )

        try:
            from backend.notifications.service import notify_listing_review
            notify_listing_review(artist.id, approved=True, tier=artist.verification_stage, db=db)
        except Exception:
            pass

        return {
            "status": "ok",
            "message": f"Artist '{artist.name}' approved successfully and is now LIVE.",
            "artist": artist.to_dict(show_sensitive=False),
        }

    else:
        # Reject: returns to DRAFT with reason
        artist.listing_status = "DRAFT"
        db.commit()
        db.refresh(artist)

        log_audit(
            db,
            action="ARTIST_REVIEW_REJECTED",
            details={
                "artist_id": artist.id,
                "operator_id": current_user.id,
                "reason": payload.reason,
                "listing_status": artist.listing_status,
            },
            actor="OPERATOR",
        )

        try:
            from backend.notifications.service import notify_listing_review
            notify_listing_review(artist.id, approved=False, reason=payload.reason, db=db)
        except Exception:
            pass

        return {
            "status": "ok",
            "message": f"Artist submission rejected: {payload.reason or 'Needs corrections'}.",
            "artist": artist.to_dict(show_sensitive=False),
        }


@artist_router.post("/artists/{artist_id}/vouch")
def submit_artist_vouch(
    artist_id: str,
    payload: VouchRequest,
    current_user: UserRow = Depends(require_role("COORDINATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Submit an independent coordinator vouch for an artist. Two independent vouches elevate to TRUSTED tier."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail=f"Artist '{artist_id}' not found.")

    # Check if this coordinator already vouched
    existing = (
        db.query(CoordinatorVouchRow)
        .filter(
            CoordinatorVouchRow.artist_id == artist_id,
            CoordinatorVouchRow.coordinator_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted a vouch for this folk artist.",
        )

    vouch_id = f"vouch_{uuid.uuid4().hex[:10]}"
    vouch = CoordinatorVouchRow(
        id=vouch_id,
        artist_id=artist_id,
        coordinator_id=current_user.id,
        notes=payload.notes.strip(),
    )
    db.add(vouch)
    db.flush()

    # Recalculate independent vouches count
    all_vouches = (
        db.query(CoordinatorVouchRow).filter(CoordinatorVouchRow.artist_id == artist_id).all()
    )
    total_vouches = len(all_vouches)

    # Verification stage progression rules:
    # 1 vouch: Elevates from REGISTERED -> COORDINATOR_VOUCHED
    # 2 vouches: If video is already approved (VIDEO_REVIEWED), elevates to TRUSTED tier!
    if total_vouches >= 2:
        if artist.verification_stage in ["VIDEO_REVIEWED", "TRUSTED"]:
            artist.verification_stage = "TRUSTED"
        else:
            artist.verification_stage = "COORDINATOR_VOUCHED"
    elif total_vouches == 1:
        if artist.verification_stage == "REGISTERED":
            artist.verification_stage = "COORDINATOR_VOUCHED"

    db.commit()
    db.refresh(artist)

    log_audit(
        db,
        action="COORDINATOR_VOUCH_RECORDED",
        details={
            "artist_id": artist_id,
            "coordinator_id": current_user.id,
            "vouch_id": vouch.id,
            "total_vouches": total_vouches,
            "verification_stage": artist.verification_stage,
        },
        actor="COORDINATOR",
    )

    return {
        "status": "ok",
        "message": "Vouch recorded successfully.",
        "vouch": vouch.to_dict(),
        "total_vouches": total_vouches,
        "verification_stage": artist.verification_stage,
    }


@artist_router.get("/artists/{artist_id}/vouches")
def get_artist_vouches(
    artist_id: str,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve all coordinator vouches recorded for an artist."""
    vouches = (
        db.query(CoordinatorVouchRow)
        .filter(CoordinatorVouchRow.artist_id == artist_id)
        .order_by(CoordinatorVouchRow.created_at.desc())
        .all()
    )
    out = []
    for v in vouches:
        d = v.to_dict()
        coord = db.query(UserRow).filter(UserRow.id == v.coordinator_id).first()
        d["coordinator_name"] = coord.name if coord else "Coordinator"
        out.append(d)
    return out


@artist_router.post("/artists/{artist_id}/events")
def trigger_artist_lifecycle_event(
    artist_id: str,
    payload: EventTriggerRequest,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Trigger lifecycle event (BOOKING_COMPLETED, NO_SHOW, LATE_CANCEL, RATING_RECEIVED) and recalculate score."""
    updated_artist = record_artist_event(
        db=db,
        artist_id=artist_id,
        event_type=payload.event_type,
        rating=payload.rating,
    )

    log_audit(
        db,
        action=f"ARTIST_EVENT_{payload.event_type.upper()}",
        details={
            "artist_id": artist_id,
            "operator_id": current_user.id,
            "reliability_score": updated_artist.reliability_score,
            "completed_bookings_count": updated_artist.completed_bookings_count,
        },
        actor="OPERATOR",
    )

    return {
        "status": "ok",
        "artist_id": updated_artist.id,
        "completed_bookings_count": updated_artist.completed_bookings_count,
        "reliability_score": updated_artist.reliability_score,
        "rating": updated_artist.rating,
        "no_shows_count": updated_artist.no_shows_count,
        "late_cancels_count": updated_artist.late_cancels_count,
    }


def to_public_profile(artist: ArtistRow, db: Session) -> Dict[str, Any]:
    """Format artist record as public profile with rate card, reliability tier, and review summary.

    Guarantees no phone or UPI is returned.
    """
    data = artist.to_dict(show_sensitive=False)
    # Strip sensitive financial / phone fields completely
    data.pop("upi_id", None)
    data.pop("masked_upi_id", None)
    data.pop("phone", None)

    # Reliability Tier computation
    if artist.reliability_score >= 90 or artist.verification_stage == "TRUSTED":
        reliability_tier = "TRUSTED"
    elif artist.reliability_score >= 80:
        reliability_tier = "HIGH"
    elif artist.reliability_score >= 60:
        reliability_tier = "STANDARD"
    else:
        reliability_tier = "DEVELOPING"

    # Rate card
    rate_card = {
        "min_fee": artist.min_fee // 100,
        "min_fee_paise": artist.min_fee,
        "travel_range_km": artist.travel_range_km,
        "min_duration_minutes": artist.min_duration_minutes,
        "max_group_size": artist.max_group_size,
        "group_size": artist.group_size,
    }

    # Review summary and vouches
    vouches = (
        db.query(CoordinatorVouchRow)
        .filter(CoordinatorVouchRow.artist_id == artist.id)
        .all()
    )
    review_summary = {
        "rating": artist.rating,
        "ratings_count": artist.ratings_count,
        "completed_bookings_count": artist.completed_bookings_count,
        "no_shows_count": artist.no_shows_count,
        "late_cancels_count": artist.late_cancels_count,
        "vouches_count": len(vouches),
        "summary": f"Rated {artist.rating:.1f}/5.0 across {artist.completed_bookings_count} completed performances.",
    }

    data["videos"] = artist.video_urls or []
    data["rate_card"] = rate_card
    data["reliability_tier"] = reliability_tier
    data["review_summary"] = review_summary
    data["vouches_count"] = len(vouches)
    return data


@artist_router.get("/artists/search")
def search_artists(
    art_form: Optional[str] = None,
    city: Optional[str] = None,
    date: Optional[str] = None,  # YYYY-MM-DD
    budget: Optional[int] = None,  # in INR
    group_size: Optional[int] = None,
    language: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Search available folk artists with multi-criteria filtering and pagination.

    Rules:
    - Only LIVE artists
    - Excludes blackout dates and recurring unavailable days
    - Filter by art_form, city, budget (artist min_fee <= budget), group size, language
    - Sorted by relevance and reliability
    - Paginated
    """
    import math
    from datetime import date as dt_date

    # 1. Base query: ONLY LIVE artists
    query = db.query(ArtistRow).filter(ArtistRow.listing_status == "LIVE")

    if art_form:
        query = query.filter(ArtistRow.art_form.ilike(f"%{art_form.strip()}%"))
    if city:
        query = query.filter(ArtistRow.city.ilike(f"%{city.strip()}%"))

    artists = query.all()

    # 2. Filter in-memory for dates, budget, group size, and language
    filtered: List[ArtistRow] = []

    target_date = None
    target_day_name = None
    if date:
        try:
            target_date = dt_date.fromisoformat(date.strip())
            target_day_name = target_date.strftime("%A")
        except ValueError:
            target_date = None

    for a in artists:
        # Check blackout dates and recurring days
        if target_date:
            date_str = target_date.isoformat()
            if a.blackout_dates and date_str in a.blackout_dates:
                continue
            if a.recurring_unavailable_days and target_day_name:
                unavail = [d.strip().lower() for d in a.recurring_unavailable_days if isinstance(d, str)]
                if target_day_name.lower() in unavail:
                    continue

        # Check budget: budget is in INR, artist.min_fee is in paise
        if budget is not None:
            budget_paise = int(budget * 100)
            if a.min_fee > budget_paise:
                continue

        # Check group size: artist must be able to support group size
        if group_size is not None:
            if a.max_group_size < group_size:
                continue

        # Check language
        if language:
            lang_req = language.strip().lower()
            artist_langs = [l.strip().lower() for l in (a.languages or []) if isinstance(l, str)]
            if not any(lang_req == al or lang_req in al for al in artist_langs):
                continue

        filtered.append(a)

    # 3. Sort by relevance and reliability
    def sort_key(artist: ArtistRow):
        relevance_score = 0
        if art_form and art_form.strip().lower() == artist.art_form.strip().lower():
            relevance_score += 50
        elif art_form and art_form.strip().lower() in artist.art_form.strip().lower():
            relevance_score += 25
        if city and city.strip().lower() == artist.city.strip().lower():
            relevance_score += 20
        # Combine relevance and reliability score
        return (relevance_score, artist.reliability_score, artist.rating)

    filtered.sort(key=sort_key, reverse=True)

    # 4. Pagination
    total = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_items = filtered[start_idx:end_idx]

    items = [to_public_profile(a, db=db) for a in paged_items]
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@artist_router.get("/artists/{artist_id}")
def get_artist_public_profile(
    artist_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve public profile for an artist."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail=f"Artist '{artist_id}' not found.")

    return to_public_profile(artist, db=db)



@artist_router.get("/artists")
def list_artists(
    status: Optional[str] = None,
    art_form: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve list of folk artists. Defaults to LIVE listings for public discovery."""
    query = db.query(ArtistRow)
    if status:
        query = query.filter(ArtistRow.listing_status == status.strip().upper())
    else:
        # Default public discovery shows LIVE artists plus pre-seeded trusted artists
        query = query.filter(ArtistRow.listing_status.in_(["LIVE", "TRUSTED"]))

    if art_form:
        query = query.filter(ArtistRow.art_form.ilike(f"%{art_form.strip()}%"))
    if city:
        query = query.filter(ArtistRow.city.ilike(f"%{city.strip()}%"))

    artists = query.order_by(ArtistRow.reliability_score.desc(), ArtistRow.name.asc()).all()
    return [a.to_dict(show_sensitive=False) for a in artists]


# -----------------------------------------------------------------------------
# Voice Notes & Structured Rule Proposals
# -----------------------------------------------------------------------------

class ConfirmVoiceProposalRequest(BaseModel):
    proposal_id: str
    confirm: bool = True


@artist_router.post("/artists/me/voice-note")
async def upload_artist_voice_note(
    file: UploadFile = File(...),
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Accept artist voice note audio, transcribe with LLM, and produce proposed structured rule updates.

    CRITICAL GUARDRAIL:
    The transcript is used ONLY to populate proposed structured fields for the artist to confirm with a button tap.
    NEVER apply a rule change or approval directly from a transcript.
    """
    artist = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist profile not found.")

    contents = await file.read()
    if len(contents) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Voice note exceeds 25MB maximum limit.")

    from backend.notifications.voice_handler import (
        create_voice_proposal,
        parse_rules_from_transcript,
        transcribe_audio_with_llm,
    )

    transcript = await transcribe_audio_with_llm(
        audio_bytes=contents,
        filename=file.filename or "voice_note.mp3",
        mime_type=file.content_type or "audio/mp3",
    )

    proposed_changes = parse_rules_from_transcript(transcript)

    proposal = create_voice_proposal(
        artist_id=artist.id,
        user_id=current_user.id,
        transcript=transcript,
        proposed_changes=proposed_changes,
        db=db,
    )

    return {
        "status": "ok",
        "proposal_id": proposal.id,
        "transcript": proposal.transcript,
        "proposed_changes": proposal.proposed_changes,
        "applied": False,
        "requires_confirmation": True,
        "message": (
            "Voice note transcribed and rules parsed into a pending proposal. "
            "Please review and confirm to apply changes."
        ),
    }


@artist_router.post("/artists/me/rules/confirm-voice-proposal")
def confirm_artist_voice_proposal(
    payload: ConfirmVoiceProposalRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Explicit artist button tap to either CONFIRM (apply changes to rules) or REJECT proposal."""
    artist = db.query(ArtistRow).filter(ArtistRow.id == current_user.artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist profile not found.")

    from backend.notifications.voice_handler import confirm_voice_proposal

    try:
        res = confirm_voice_proposal(
            proposal_id=payload.proposal_id,
            artist_id=artist.id,
            confirm=payload.confirm,
            db=db,
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

