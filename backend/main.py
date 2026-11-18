"""Main entry point for the Dharohar FastAPI backend application with authentication & RBAC."""

import os
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set

import json
import hashlib
import hmac

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.agents.llm import set_scripted_responses
from backend.agents.negotiation import run_negotiation
from backend.artist_routes import artist_router
from backend.audit import get_audit_log, log_event
from backend.auth import (
    auth_router,
    get_current_user,
    is_demo_mode,
    limiter,
    require_role,
)
from backend.config import get_settings, settings
from backend.database import (
    ArtistRow,
    AuditLogRow,
    BookingRow,
    CoordinatorVouchRow,
    NotificationLogRow,
    OrganizerProfileRow,
    ReconciliationTicketRow,
    SingleUseActionTokenRow,
    TrustPayRow,
    UserRow,
    VoiceProposalRow,
    WebhookEventRow,
    get_db,
    init_db,
)
from backend.logging_config import RequestIdAndLoggingMiddleware, configure_logging, logger
from backend.organizer_routes import organizer_router
from backend.seed import seed_database
from backend.storage import get_upload_dir
from backend.trustpay import MockProvider, RazorpayProvider, TrustPayService, get_payment_provider

# Initialize structured JSON logging
configure_logging()

app = FastAPI(
    title="Dharohar API",
    description="Configurable booking platform for folk artists with role-based auth",
    version="0.3.0",
)

# Register slowapi rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Attach request-tracing and structured JSON logging middleware
app.add_middleware(RequestIdAndLoggingMiddleware)

# Mount authentication, artist management, and organizer management routers
app.include_router(auth_router)
app.include_router(artist_router)
app.include_router(organizer_router)

# Mount static files directory for media uploads (audition videos and photos)
upload_dir = get_upload_dir()
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# Payment provider selection: mock when PAYMENT_PROVIDER=mock, real Razorpay when PAYMENT_PROVIDER=razorpay
class DynamicTrustPayService:
    """Delegates dynamically to TrustPayService with provider resolved from config."""

    @property
    def service(self) -> TrustPayService:
        return TrustPayService(provider=get_payment_provider())

    def __getattr__(self, name: str):
        return getattr(self.service, name)


try:
    mock_provider = get_payment_provider("mock")
except Exception:
    mock_provider = MockProvider(allow_non_demo=True)

trustpay_service = DynamicTrustPayService()

# In-memory booking payload cache for multi-role structures
booking_store: Dict[str, Dict[str, Any]] = {}

# Schema management is delegated strictly to Alembic migrations (no create_all at app startup)

# Enable CORS using configured ALLOWED_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_demo_mode():
    """Dependency that ensures demo-only routes only exist when DEMO_MODE=true."""
    if not get_settings().DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not Found",
        )


# ---------------------------------------------------------------------------
# Access Control Helpers
# ---------------------------------------------------------------------------


def get_booking_artists(booking_id: str, db: Session) -> Set[str]:
    """Extract set of artist IDs involved in the booking from store and audit logs."""
    artists: Set[str] = set()
    store_data = booking_store.get(booking_id, {})

    # From negotiated roles
    negotiated_roles = store_data.get("negotiated_roles", {})
    for info in negotiated_roles.values():
        if isinstance(info, dict) and info.get("artist_id"):
            artists.add(info["artist_id"])

    # From approvals
    for aid in store_data.get("artist_approvals", {}).keys():
        artists.add(aid)

    # From persistent audit records
    logs = db.query(AuditLogRow).filter(AuditLogRow.booking_id == booking_id).all()
    for l in logs:
        if isinstance(l.details, dict):
            aid = l.details.get("artist_id")
            if aid:
                artists.add(aid)
            cand_id = l.details.get("candidate_artist_id")
            if cand_id:
                artists.add(cand_id)

    return artists


def verify_booking_read_access(
    booking: BookingRow, current_user: UserRow, db: Session
) -> None:
    """Verify that current_user is the organizer, an artist in the booking, or an operator."""
    if current_user.role == "OPERATOR":
        return

    if current_user.role == "ORGANIZER":
        if booking.created_by_user_id == current_user.id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not the organizer who created this booking.",
        )

    if current_user.role == "ARTIST":
        involved = get_booking_artists(booking.id, db)
        if current_user.artist_id and current_user.artist_id in involved:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: Artist '{current_user.artist_id}' is not part of booking '{booking.id}'."
            ),
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Not authorized to access this booking.",
    )


# ---------------------------------------------------------------------------
# Request Models
# ---------------------------------------------------------------------------


class RoleSpec(BaseModel):
    art_form: str
    role: Optional[str] = None
    budget: Optional[int] = None


class BookingCreateRequest(BaseModel):
    organizer_name: str
    roles: List[RoleSpec] = Field(default_factory=list)
    roles_needed: Optional[List[RoleSpec]] = None
    event_date: str
    event_time: Optional[str] = "18:00"
    venue_address: Optional[str] = ""
    budget: int
    distance_km: int = 100
    expected_duration_minutes: Optional[int] = None
    duration_minutes: int = 60
    group_size: int = 6
    notes: Optional[str] = ""


class ArtistAckRequest(BaseModel):
    confirmed: bool


class OrganizerApproveChangeRequest(BaseModel):
    role: Optional[str] = None
    artist_id: Optional[str] = None
    reason: Optional[str] = "Organizer approved standby change"


class ProviderConfigRequest(BaseModel):
    provider: str  # "scripted" | "gemini" | "anthropic"


# ---------------------------------------------------------------------------
# Core & Health Routes
# ---------------------------------------------------------------------------


@app.get("/config")
def get_public_config():
    """Public platform configuration (payment provider, environment, demo mode)."""
    cfg = get_settings()
    return {
        "status": "ok",
        "env": cfg.ENV,
        "demo_mode": cfg.DEMO_MODE,
        "payment_provider": cfg.PAYMENT_PROVIDER,
    }


@app.get("/health")
def health_check():
    """Health check endpoint indicating operational status and simulation mode (Public)."""
    cfg = get_settings()
    return {
        "status": "ok",
        "mode": "SIMULATED" if cfg.DEMO_MODE or cfg.PAYMENT_PROVIDER == "mock" else "PRODUCT",
        "payment_provider": cfg.PAYMENT_PROVIDER,
    }


@app.post("/seed", dependencies=[Depends(require_demo_mode)])
def seed_data(
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
):
    """Reset and seed the database with fictional folk artist profiles (OPERATOR only in DEMO_MODE)."""
    artists = seed_database(db=db)
    return {
        "status": "ok",
        "message": f"Successfully seeded {len(artists)} fictional artists and users",
        "count": len(artists),
    }


# ---------------------------------------------------------------------------
# Booking & Negotiation Routes
# ---------------------------------------------------------------------------


@app.post("/bookings", status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreateRequest,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a new simulated booking request (ORGANIZER only)."""
    booking_id = f"book_{uuid.uuid4().hex[:8]}"
    parsed_date = date.fromisoformat(payload.event_date)

    input_roles = payload.roles_needed if payload.roles_needed is not None else payload.roles
    if not input_roles and payload.roles:
        input_roles = payload.roles
    primary_art_form = input_roles[0].art_form if input_roles else "Folk Art"
    dur = payload.expected_duration_minutes or payload.duration_minutes

    # Convert incoming budget from INR to integer paise at the API boundary
    budget_paise = int(payload.budget * 100)

    # Save details into store for multi-role negotiation (storing amounts in paise)
    normalized_roles = []
    for idx, r in enumerate(input_roles):
        r_budget = r.budget or (payload.budget // (len(input_roles) or 1))
        normalized_roles.append(
            {
                "role": r.role or f"role_{idx + 1}",
                "art_form": r.art_form,
                "budget": int(r_budget * 100),
            }
        )

    booking = BookingRow(
        id=booking_id,
        organizer_name=payload.organizer_name,
        art_form_requested=primary_art_form,
        event_date=parsed_date,
        event_time=payload.event_time or "18:00",
        venue_address=payload.venue_address or "",
        expected_duration_minutes=dur,
        group_size=payload.group_size,
        notes=payload.notes or "",
        budget=budget_paise,
        status="REQUESTED",
        roles_needed=normalized_roles,
        standby_candidates={},
        created_by_user_id=current_user.id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    store_data = {
        "organizer_name": payload.organizer_name,
        "roles": normalized_roles,
        "event_date": payload.event_date,
        "event_time": payload.event_time or "18:00",
        "venue_address": payload.venue_address or "",
        "expected_duration_minutes": dur,
        "duration_minutes": dur,
        "total_budget": budget_paise,
        "budget": budget_paise,
        "distance_km": payload.distance_km,
        "group_size": payload.group_size,
        "notes": payload.notes or "",
        "negotiated_roles": {},
        "artist_approvals": {},
        "standby_candidates": {},
        "created_by_user_id": current_user.id,
    }
    booking_store[booking_id] = store_data

    log_event(
        booking_id=booking_id,
        actor="ORGANIZER",
        action="OFFER_PROPOSED",
        details={
            "event": "BOOKING_CREATED",
            "roles": normalized_roles,
            "budget": payload.budget,
            "venue_address": payload.venue_address or "",
            "actor_user_id": current_user.id,
            "actor_role": current_user.role,
        },
        db=db,
    )

    return {
        **booking.to_dict(for_user=current_user),
        "roles": normalized_roles,
    }


@app.get("/bookings")
def list_bookings(
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List bookings relevant to the authenticated user (ORGANIZER, ARTIST, OPERATOR)."""
    if current_user.role == "OPERATOR":
        bookings = db.query(BookingRow).order_by(BookingRow.created_at.desc()).limit(50).all()
    elif current_user.role == "ORGANIZER":
        bookings = (
            db.query(BookingRow)
            .filter(BookingRow.created_by_user_id == current_user.id)
            .order_by(BookingRow.created_at.desc())
            .limit(50)
            .all()
        )
    elif current_user.role == "ARTIST":
        all_recent = db.query(BookingRow).order_by(BookingRow.created_at.desc()).limit(50).all()
        bookings = [
            b for b in all_recent
            if current_user.artist_id and current_user.artist_id in get_booking_artists(b.id, db)
        ]
    else:
        bookings = db.query(BookingRow).order_by(BookingRow.created_at.desc()).limit(20).all()

    return [
        {
            **b.to_dict(for_user=current_user),
            "negotiated_roles": booking_store.get(b.id, {}).get("negotiated_roles", {}),
            "artist_approvals": booking_store.get(b.id, {}).get("artist_approvals", {}),
        }
        for b in bookings
    ]


@app.post("/bookings/{booking_id}/negotiate")
def negotiate_booking(
    booking_id: str,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Execute multi-agent negotiation (ORGANIZER only, booking creator only)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You did not create this booking and cannot initiate negotiation.",
        )

    if booking.status in ["CLOSED", "CANCELLED"]:
        raise HTTPException(
            status_code=400, detail=f"Cannot negotiate booking in '{booking.status}' status."
        )

    store_data = booking_store.get(booking_id)
    if not store_data:
        store_data = {
            "organizer_name": booking.organizer_name,
            "roles": [{"role": "main", "art_form": booking.art_form_requested, "budget": booking.budget}],
            "event_date": booking.event_date.isoformat(),
            "total_budget": booking.budget,
            "budget": booking.budget,
            "distance_km": 100,
            "duration_minutes": 60,
            "group_size": 6,
            "negotiated_roles": {},
            "artist_approvals": {},
            "created_by_user_id": booking.created_by_user_id,
        }
        booking_store[booking_id] = store_data

    negotiation_result = run_negotiation(
        booking_id=booking_id,
        request=store_data,
        db=db,
    )

    store_data["negotiated_roles"] = negotiation_result.get("roles", {})

    return negotiation_result


@app.get("/bookings/{booking_id}")
def get_booking(
    booking_id: str,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve booking details (Allowed for creator organizer, booking artists, and operators)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    verify_booking_read_access(booking, current_user, db)

    store_data = booking_store.get(booking_id, {})
    booking_dict = booking.to_dict(for_user=current_user)

    # Privacy masking for contact details until payment is received
    organizer_user = (
        db.query(UserRow).filter(UserRow.id == booking.created_by_user_id).first()
        if booking.created_by_user_id
        else None
    )
    org_profile = (
        db.query(OrganizerProfileRow)
        .filter(OrganizerProfileRow.user_id == booking.created_by_user_id)
        .first()
        if booking.created_by_user_id
        else None
    )

    if current_user.role == "ARTIST" and booking.status not in ["PAID", "PERFORMED", "SETTLED"]:
        booking_dict["organizer_phone"] = "Hidden until booking payment is received in escrow"
        booking_dict["organizer_email"] = "Hidden until booking payment is received in escrow"
    else:
        booking_dict["organizer_phone"] = organizer_user.phone if organizer_user else ""
        booking_dict["organizer_email"] = (
            org_profile.work_email if org_profile and org_profile.work_email else ""
        )

    return {
        **booking_dict,
        "roles": store_data.get("roles", booking.roles_needed or []),
        "negotiated_roles": store_data.get("negotiated_roles", {}),
        "artist_approvals": store_data.get("artist_approvals", {}),
        "standby_candidates": booking.standby_candidates or store_data.get("standby_candidates", {}),
    }


@app.post("/bookings/{booking_id}/organizer-approve-change")
def organizer_approve_change(
    booking_id: str,
    payload: Optional[OrganizerApproveChangeRequest] = None,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Organizer explicitly approves a flagged standby candidate (ORGANIZER only, creator only)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You did not create this booking and cannot approve candidate changes.",
        )

    if booking.status in ["CLOSED", "CANCELLED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve change on booking in '{booking.status}' status.",
        )

    role_name = payload.role if payload else None
    artist_id = payload.artist_id if payload else None
    reason = payload.reason if payload else "Organizer approved standby change"

    store_data = booking_store.get(booking_id)
    if store_data and role_name and role_name in store_data.get("negotiated_roles", {}):
        store_data["negotiated_roles"][role_name]["status"] = "VALID"

    log_event(
        booking_id=booking_id,
        actor="ORGANIZER",
        action="ORGANIZER_APPROVED_CHANGE",
        details={
            "role": role_name,
            "artist_id": artist_id,
            "reason": reason,
            "actor_user_id": current_user.id,
            "actor_role": current_user.role,
        },
        db=db,
    )

    return {
        "status": "ok",
        "message": "Organizer approved change",
        "booking_id": booking_id,
    }


def execute_artist_approval(
    booking_id: str,
    artist_id: str,
    actor_user_id: Optional[str],
    db: Session,
) -> Dict[str, Any]:
    """Shared execution logic for human artist approval (web panel, WhatsApp, or action link)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.status != "AWAITING_ARTIST_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Booking is in status '{booking.status}', must be 'AWAITING_ARTIST_APPROVAL'.",
        )

    log_event(
        booking_id=booking_id,
        actor="ARTIST",
        action="ARTIST_APPROVED",
        details={
            "artist_id": artist_id,
            "actor_user_id": actor_user_id or f"ACTION_LINK:{artist_id}",
            "actor_role": "ARTIST",
        },
        db=db,
    )

    store_data = booking_store.setdefault(booking_id, {})
    approvals = store_data.setdefault("artist_approvals", {})
    approvals[artist_id] = True

    # Check if all artists for all roles have approved
    negotiated_roles = store_data.get("negotiated_roles", {})
    expected_artists = {
        info["artist_id"]
        for info in negotiated_roles.values()
        if isinstance(info, dict) and info.get("artist_id")
    }

    if not expected_artists or all(approvals.get(aid) for aid in expected_artists):
        booking.status = "APPROVED"
        db.commit()
        db.refresh(booking)

    return {
        "status": "ok",
        "action": "ARTIST_APPROVED",
        "artist_id": artist_id,
        "booking_status": booking.status,
    }


def execute_artist_decline(
    booking_id: str,
    artist_id: str,
    actor_user_id: Optional[str],
    db: Session,
) -> Dict[str, Any]:
    """Shared execution logic for human artist decline (web panel, WhatsApp, or action link)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    log_event(
        booking_id=booking_id,
        actor="ARTIST",
        action="ARTIST_DECLINED",
        details={
            "artist_id": artist_id,
            "actor_user_id": actor_user_id or f"ACTION_LINK:{artist_id}",
            "actor_role": "ARTIST",
        },
        db=db,
    )

    # Auto-trigger replacement candidate check
    store_data = booking_store.setdefault(booking_id, {})
    negotiated_roles = store_data.setdefault("negotiated_roles", {})
    standbys = dict(booking.standby_candidates or {})

    # Identify role that declined
    target_role = None
    for r_name, r_info in negotiated_roles.items():
        if isinstance(r_info, dict) and r_info.get("artist_id") == artist_id:
            target_role = r_name
            break

    if not target_role and standbys:
        target_role = list(standbys.keys())[0]

    replacement = None
    if target_role and standbys.get(target_role):
        replacement = standbys[target_role].pop(0)
        booking.standby_candidates = standbys

        negotiated_roles[target_role] = {
            "artist_id": replacement["artist_id"],
            "price": replacement.get("min_fee") or 15000,
            "status": "VALID",
            "decision": "RECOMMEND_ACCEPT",
            "reasons": [
                f"Auto-promoted standby candidate {replacement.get('name', replacement['artist_id'])} after {artist_id} declined."
            ],
        }
        store_data["negotiated_roles"] = negotiated_roles

        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="STANDBY_PROMOTED",
            details={
                "declined_artist_id": artist_id,
                "replacement_artist_id": replacement["artist_id"],
                "role": target_role,
                "reason": "Artist declined; auto-promoted standby replacement candidate.",
            },
            db=db,
        )

        booking.status = "AWAITING_ARTIST_APPROVAL"
        booking.approval_expires_at = datetime.utcnow() + timedelta(
            hours=getattr(get_settings(), "APPROVAL_EXPIRY_HOURS", 24)
        )
        try:
            from backend.notifications.service import notify_offer_awaiting_approval
            notify_offer_awaiting_approval(
                booking=booking,
                roles_outcome={target_role: negotiated_roles[target_role]},
                db=db,
            )
        except Exception:
            pass
    else:
        booking.status = "NEEDS_OPERATOR"
        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="NO_STANDBY_AVAILABLE",
            details={
                "declined_artist_id": artist_id,
                "role": target_role,
                "reason": "Artist declined and no replacement standby candidates available.",
            },
            db=db,
        )

    db.commit()
    db.refresh(booking)

    return {
        "status": "ok",
        "action": "ARTIST_DECLINED",
        "artist_id": artist_id,
        "booking_status": booking.status,
        "replacement_artist": replacement,
    }


@app.post("/bookings/{booking_id}/artist/{artist_id}/approve")
def artist_approve_booking(
    booking_id: str,
    artist_id: str,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Human artist explicit approval (ARTIST only, token artist_id must match URL)."""
    if current_user.artist_id != artist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: You cannot approve on behalf of artist '{artist_id}'. "
                f"Your assigned artist identity is '{current_user.artist_id}'."
            ),
        )
    return execute_artist_approval(booking_id, artist_id, current_user.id, db)


@app.post("/bookings/{booking_id}/artist/{artist_id}/decline")
def artist_decline_booking(
    booking_id: str,
    artist_id: str,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Human artist explicit decline (ARTIST only, token artist_id must match URL)."""
    if current_user.artist_id != artist_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: You cannot decline on behalf of artist '{artist_id}'. "
                f"Your assigned artist identity is '{current_user.artist_id}'."
            ),
        )
    return execute_artist_decline(booking_id, artist_id, current_user.id, db)


class VerifyActionTokenRequest(BaseModel):
    token: str


@app.post("/api/actions/verify")
@app.get("/api/actions/verify")
def verify_action_link(
    token: Optional[str] = Query(None),
    payload: Optional[VerifyActionTokenRequest] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Signed, single-use, expiring action link handler for web and email quick approvals.

    Single-use link cannot be reused (consumed / expired return 410 / 400).
    """
    token_str = token or (payload.token if payload else None)
    if not token_str:
        raise HTTPException(status_code=400, detail="Missing required token parameter.")

    from backend.notifications.tokens import verify_and_consume_token

    try:
        token_row = verify_and_consume_token(token_str, db)
    except ValueError as e:
        err_msg = str(e)
        if "already been used" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_410_GONE, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    # Execute corresponding action with exact same logic
    if token_row.action == "APPROVE":
        res = execute_artist_approval(
            booking_id=token_row.booking_id,
            artist_id=token_row.artist_id,
            actor_user_id=f"TOKEN:{token_row.id[:8]}",
            db=db,
        )
    elif token_row.action == "DECLINE":
        res = execute_artist_decline(
            booking_id=token_row.booking_id,
            artist_id=token_row.artist_id,
            actor_user_id=f"TOKEN:{token_row.id[:8]}",
            db=db,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action: '{token_row.action}'.")

    return {
        "status": "ok",
        "action": token_row.action,
        "booking_id": token_row.booking_id,
        "artist_id": token_row.artist_id,
        "result": res,
    }


@app.post("/bookings/{booking_id}/check-expiry")
def check_booking_expiry(
    booking_id: str,
    force: bool = False,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Check if booking artist approval has expired; if so, trigger replacement candidate check."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    now = datetime.utcnow()
    is_expired = force or (
        booking.approval_expires_at and now > booking.approval_expires_at
    )

    if booking.status == "AWAITING_ARTIST_APPROVAL" and is_expired:
        store_data = booking_store.setdefault(booking_id, {})
        approvals = store_data.get("artist_approvals", {})
        negotiated_roles = store_data.get("negotiated_roles", {})

        unapproved_artists = [
            info["artist_id"]
            for info in negotiated_roles.values()
            if isinstance(info, dict) and info.get("artist_id") and not approvals.get(info["artist_id"])
        ]

        expired_aid = unapproved_artists[0] if unapproved_artists else "unknown_artist"

        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="APPROVAL_EXPIRED",
            details={
                "booking_id": booking_id,
                "unapproved_artists": unapproved_artists,
                "reason": "Approval request duration exceeded without confirmation.",
            },
            db=db,
        )

        standbys = dict(booking.standby_candidates or {})
        promoted = False
        for role_name, cands in standbys.items():
            if cands:
                cand = cands.pop(0)
                booking.standby_candidates = standbys
                negotiated_roles[role_name] = {
                    "artist_id": cand["artist_id"],
                    "price": cand.get("min_fee") or 15000,
                    "status": "VALID",
                    "decision": "RECOMMEND_ACCEPT",
                    "reasons": [
                        f"Auto-promoted standby candidate {cand['name']} after approval expired."
                    ],
                }
                store_data["negotiated_roles"] = negotiated_roles
                booking.status = "AWAITING_ARTIST_APPROVAL"
                booking.approval_expires_at = now + timedelta(
                    hours=getattr(get_settings(), "APPROVAL_EXPIRY_HOURS", 24)
                )
                promoted = True
                log_event(
                    booking_id=booking_id,
                    actor="SYSTEM",
                    action="STANDBY_PROMOTED_ON_EXPIRY",
                    details={
                        "expired_artist_id": expired_aid,
                        "replacement_artist_id": cand["artist_id"],
                        "role": role_name,
                    },
                    db=db,
                )
                break

        if not promoted:
            booking.status = "NEEDS_OPERATOR"
            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="NO_STANDBY_AVAILABLE_FOR_EXPIRED_BOOKING",
                details={"booking_id": booking_id},
                db=db,
            )

        db.commit()
        db.refresh(booking)

    return {
        "status": "ok",
        "booking_id": booking_id,
        "booking_status": booking.status,
        "approval_expired": bool(booking.approval_expires_at and now > booking.approval_expires_at),
        "approval_expires_at": (
            booking.approval_expires_at.isoformat() if booking.approval_expires_at else None
        ),
    }


@app.post("/bookings/{booking_id}/reconfirm-standby")
def reconfirm_standby_candidates(
    booking_id: str,
    force: bool = False,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Re-confirm standby candidates 72 hours before the event date."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    now = datetime.utcnow()
    event_dt = datetime.combine(booking.event_date, datetime.min.time())
    is_within_72h = force or (now >= event_dt - timedelta(hours=72) and now < event_dt)

    if not is_within_72h:
        return {
            "status": "ok",
            "message": "Event is not within 72 hours window yet.",
            "standby_reconfirmed": bool(booking.standby_reconfirmed),
            "hours_until_event": (event_dt - now).total_seconds() / 3600,
        }

    standbys = dict(booking.standby_candidates or {})
    confirmed_count = 0
    for role_name, cands in standbys.items():
        for cand in cands:
            cand["status"] = "CONFIRMATION_REQUESTED"
            confirmed_count += 1
            log_event(
                booking_id=booking_id,
                actor="SYSTEM",
                action="STANDBY_RECONFIRMATION_REQUESTED",
                details={
                    "booking_id": booking_id,
                    "artist_id": cand.get("artist_id"),
                    "artist_name": cand.get("name"),
                    "role": role_name,
                    "event_date": booking.event_date.isoformat(),
                    "notice": "Issued 72-hour pre-event standby confirmation request.",
                },
                db=db,
            )

    booking.standby_candidates = standbys
    booking.standby_reconfirmed = 1
    booking.standby_reconfirm_at = now
    db.commit()
    db.refresh(booking)

    try:
        from backend.notifications.service import notify_standby_reconfirmation
        notify_standby_reconfirmation(booking, db)
    except Exception:
        pass

    return {
        "status": "ok",
        "standby_reconfirmed": True,
        "reconfirmed_at": booking.standby_reconfirm_at.isoformat(),
        "candidates_notified": confirmed_count,
    }


# ---------------------------------------------------------------------------
# TrustPay Escrow, Payouts & Demo Simulation Routes
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# TrustPay Escrow, Payouts & Razorpay Payment Gateway Routes
# ---------------------------------------------------------------------------


class PaymentVerifyRequest(BaseModel):
    """Payload sent by frontend upon completing Razorpay Checkout modal."""
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ReleasePayoutRequest(BaseModel):
    """Payload for operator payout release."""
    early_approval: bool = False


@app.post("/bookings/{booking_id}/payment/order")
def create_payment_order(
    booking_id: str,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a real Razorpay Order for the full amount in paise with receipt = booking id."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You did not create this booking and cannot deposit escrow funds.",
        )

    # Verification gate: Unverified organizers cannot pay for bookings exceeding Rs 20,000 (2,000,000 paise)
    if booking.budget > 2000000:
        org_profile = (
            db.query(OrganizerProfileRow)
            .filter(OrganizerProfileRow.user_id == current_user.id)
            .first()
        )
        if not org_profile or org_profile.verification_status != "VERIFIED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unverified organizers cannot pay for bookings exceeding Rs 20,000. Please complete organizer verification.",
            )

    # Guard: requires artist approval
    approval_entry = (
        db.query(AuditLogRow)
        .filter(AuditLogRow.booking_id == booking_id, AuditLogRow.action == "ARTIST_APPROVED")
        .first()
    )
    if not approval_entry:
        raise HTTPException(
            status_code=400,
            detail="Cannot pay: Artist approval has not been recorded.",
        )

    original_status = booking.status
    if booking.status == "APPROVED":
        booking.status = "AWAITING_ARTIST_APPROVAL"
        db.commit()

    try:
        order_res = trustpay_service.start_payment(booking_id=booking_id, db=db)
        return {
            "status": "ok",
            "order_id": order_res["order_id"],
            "amount_paise": order_res.get("fees", {}).get("total_organizer_paise", booking.budget),
            "currency": "INR",
            "key_id": get_settings().RAZORPAY_KEY_ID or "rzp_test_placeholder",
            "booking_id": booking_id,
            "fees": order_res.get("fees"),
        }
    except ValueError as e:
        booking.status = original_status
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bookings/{booking_id}/payment/verify")
def verify_payment_and_capture(
    booking_id: str,
    payload: PaymentVerifyRequest,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Verify Razorpay payment signature with RAZORPAY_KEY_SECRET.

    Moves booking to PAID ONLY upon successful signature verification.
    """
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You did not create this booking.",
        )

    # Verify signature
    provider = get_payment_provider()
    is_valid = False
    if isinstance(provider, RazorpayProvider):
        is_valid = provider.verify_payment_signature(
            order_id=payload.razorpay_order_id,
            payment_id=payload.razorpay_payment_id,
            signature=payload.razorpay_signature,
        )
    elif get_settings().RAZORPAY_KEY_SECRET:
        msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8")
        secret_bytes = get_settings().RAZORPAY_KEY_SECRET.encode("utf-8")
        expected = hmac.new(secret_bytes, msg, hashlib.sha256).hexdigest()
        is_valid = hmac.compare_digest(expected, payload.razorpay_signature)
    elif get_settings().DEMO_MODE:
        # In demo mode without secrets configured, accept test signatures
        is_valid = True

    if not is_valid:
        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="STANDBY_CHECKED",
            details={
                "event": "PAYMENT_SIGNATURE_VERIFICATION_FAILED",
                "order_id": payload.razorpay_order_id,
            },
            db=db,
        )
        raise HTTPException(
            status_code=400,
            detail="Payment verification failed: Invalid signature.",
        )

    # Transition booking to PAID
    confirm_res = trustpay_service.record_organizer_payment(
        booking_id=booking_id,
        txn_id=payload.razorpay_payment_id,
        db=db,
    )

    log_event(
        booking_id=booking_id,
        actor="ORGANIZER",
        action="OFFER_ACCEPTED",
        details={
            "event": "ESCROW_DEPOSIT_PAID",
            "payment_id": payload.razorpay_payment_id,
            "order_id": payload.razorpay_order_id,
            "actor_user_id": current_user.id,
        },
        db=db,
    )

    try:
        from backend.notifications.service import notify_payment_received
        trustpay_rec = db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
        notify_payment_received(booking_id, trustpay_rec.amount if trustpay_rec else 0, db)
    except Exception:
        pass

    return {
        "status": "ok",
        "booking_status": "PAID",
        "payment_id": payload.razorpay_payment_id,
        "order_id": payload.razorpay_order_id,
        "payment": confirm_res,
    }


@app.post("/bookings/{booking_id}/pay")
def pay_booking(
    booking_id: str,
    payload: Optional[PaymentVerifyRequest] = None,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Execute escrow deposit or create order (ORGANIZER only, creator only)."""
    # If payment verification details are provided, verify signature
    if payload and payload.razorpay_signature:
        return verify_payment_and_capture(
            booking_id=booking_id,
            payload=payload,
            current_user=current_user,
            db=db,
        )

    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    if booking.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You did not create this booking and cannot deposit escrow funds.",
        )

    # Verification gate: Unverified organizers cannot pay for bookings exceeding Rs 20,000 (2,000,000 paise)
    if booking.budget > 2000000:
        org_profile = (
            db.query(OrganizerProfileRow)
            .filter(OrganizerProfileRow.user_id == current_user.id)
            .first()
        )
        if not org_profile or org_profile.verification_status != "VERIFIED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unverified organizers cannot pay for bookings exceeding Rs 20,000. Please complete organizer verification.",
            )

    # Guard: requires artist approval
    approval_entry = (
        db.query(AuditLogRow)
        .filter(AuditLogRow.booking_id == booking_id, AuditLogRow.action == "ARTIST_APPROVED")
        .first()
    )
    if not approval_entry:
        raise HTTPException(
            status_code=400,
            detail="Cannot pay: Artist approval has not been recorded.",
        )

    original_status = booking.status
    if booking.status == "APPROVED":
        booking.status = "AWAITING_ARTIST_APPROVAL"
        db.commit()

    try:
        order_res = trustpay_service.start_payment(booking_id=booking_id, db=db)

        # When PAYMENT_PROVIDER == "mock" (or DEMO_MODE=True), simulate synchronous payment completion
        current_settings = get_settings()
        is_mock = (current_settings.PAYMENT_PROVIDER == "mock") or current_settings.DEMO_MODE
        if is_mock:
            confirm_res = trustpay_service.record_organizer_payment(
                booking_id=booking_id, db=db
            )
            log_event(
                booking_id=booking_id,
                actor="ORGANIZER",
                action="OFFER_ACCEPTED",
                details={
                    "event": "ESCROW_DEPOSIT_PAID",
                    "amount": booking.budget,
                    "actor_user_id": current_user.id,
                    "actor_role": current_user.role,
                },
                db=db,
            )
            try:
                from backend.notifications.service import notify_payment_received
                trustpay_rec = db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
                notify_payment_received(booking_id, trustpay_rec.amount if trustpay_rec else 0, db)
            except Exception:
                pass
            return {
                "status": "ok",
                "order": order_res,
                "payment": confirm_res,
                "booking_status": "PAID",
                "payment_provider": "mock",
            }

        # In razorpay provider mode, return order for frontend Razorpay checkout
        return {
            "status": "ok",
            "order": order_res,
            "order_id": order_res["order_id"],
            "amount_paise": order_res.get("fees", {}).get("total_organizer_paise", booking.budget),
            "currency": "INR",
            "key_id": current_settings.RAZORPAY_KEY_ID or "",
            "fees": order_res.get("fees"),
            "booking_status": booking.status,
            "payment_provider": current_settings.PAYMENT_PROVIDER,
        }
    except ValueError as e:
        booking.status = original_status
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Razorpay Webhook endpoint.

    Verifies signature using RAZORPAY_WEBHOOK_SECRET on the raw body,
    records every event in WebhookEventRow with its event id,
    processes each event id ONLY ONCE (idempotency),
    and returns 200 quickly. Returns 404 when PAYMENT_PROVIDER=mock.
    """
    current_settings = get_settings()
    if current_settings.PAYMENT_PROVIDER == "mock":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Razorpay webhook is disabled when PAYMENT_PROVIDER=mock",
        )

    body_bytes = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("x-razorpay-signature") or ""

    webhook_secret = current_settings.RAZORPAY_WEBHOOK_SECRET or ""
    provider = get_payment_provider()

    # Signature verification
    if isinstance(provider, RazorpayProvider) or webhook_secret:
        if not signature:
            logger.warning("Razorpay webhook rejected: missing X-Razorpay-Signature")
            raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature header")

        valid = False
        if isinstance(provider, RazorpayProvider):
            valid = provider.verify_webhook_signature(body_bytes, signature, webhook_secret)
        elif webhook_secret:
            secret_bytes = webhook_secret.encode("utf-8")
            expected = hmac.new(secret_bytes, body_bytes, hashlib.sha256).hexdigest()
            valid = hmac.compare_digest(expected, signature)

        if not valid:
            logger.warning("Razorpay webhook rejected: invalid signature")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed JSON payload: {e}")

    event_id = data.get("id") or data.get("event_id")
    if not event_id:
        event_id = f"evt_{hashlib.sha256(body_bytes).hexdigest()[:16]}"

    event_type = data.get("event", "unknown")

    # Idempotency check: process each event id ONLY ONCE
    existing = db.query(WebhookEventRow).filter(WebhookEventRow.id == event_id).first()
    if existing:
        logger.info("Razorpay webhook event %s already processed (idempotent)", event_id)
        return {"status": "ok", "message": "Event already processed", "event_id": event_id}

    # Record event in WebhookEventRow
    webhook_row = WebhookEventRow(
        id=event_id,
        event_type=event_type,
        payload=data,
        processed=True,
    )
    db.add(webhook_row)
    db.commit()

    # Process events
    payload_entity = data.get("payload", {})

    if event_type == "payment.captured":
        payment = payload_entity.get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        notes = payment.get("notes", {})
        booking_id = notes.get("booking_id")

        trustpay = None
        if booking_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
        if not trustpay and order_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.order_id == order_id).first()

        if trustpay:
            trustpay.organizer_payment_status = "RECEIVED"
            trustpay.txn_id = payment_id
            booking = db.query(BookingRow).filter(BookingRow.id == trustpay.booking_id).first()
            if booking:
                booking.status = "PAID"
            db.commit()
            log_event(
                booking_id=trustpay.booking_id,
                actor="SYSTEM",
                action="ORGANIZER_APPROVED_CHANGE",
                details={
                    "event": "WEBHOOK_PAYMENT_CAPTURED",
                    "payment_id": payment_id,
                    "order_id": order_id,
                },
                db=db,
            )
            try:
                from backend.notifications.service import notify_payment_received
                notify_payment_received(trustpay.booking_id, trustpay.amount, db)
            except Exception:
                pass

    elif event_type == "payment.failed":
        payment = payload_entity.get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")
        payment_id = payment.get("id")
        notes = payment.get("notes", {})
        booking_id = notes.get("booking_id")
        error_desc = payment.get("error_description", "Payment failed")

        trustpay = None
        if booking_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
        if not trustpay and order_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.order_id == order_id).first()

        if trustpay:
            log_event(
                booking_id=trustpay.booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "PAYMENT_FAILED",
                    "payment_id": payment_id,
                    "order_id": order_id,
                    "error": error_desc,
                },
                db=db,
            )

    elif event_type == "refund.processed":
        refund = payload_entity.get("refund", {}).get("entity", {})
        payment_id = refund.get("payment_id")
        refund_id = refund.get("id")
        refund_amount = refund.get("amount", 0)

        trustpay = None
        if payment_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.txn_id == payment_id).first()

        if trustpay:
            trustpay.organizer_payment_status = "REFUNDED"
            trustpay.refund_id = refund_id
            trustpay.refund_amount = refund_amount
            booking = db.query(BookingRow).filter(BookingRow.id == trustpay.booking_id).first()
            if booking:
                booking.status = "CANCELLED"
            db.commit()
            log_event(
                booking_id=trustpay.booking_id,
                actor="SYSTEM",
                action="ORGANIZER_APPROVED_CHANGE",
                details={
                    "event": "WEBHOOK_REFUND_PROCESSED",
                    "refund_id": refund_id,
                    "amount": refund_amount,
                },
                db=db,
            )
            try:
                from backend.notifications.service import notify_refund_processed
                notify_refund_processed(trustpay.booking_id, refund_id or "ref_unknown", refund_amount, db)
            except Exception:
                pass

    elif event_type in ["transfer.processed", "payout.processed"]:
        transfer = payload_entity.get("transfer", {}).get("entity", {}) or payload_entity.get("payout", {}).get("entity", {})
        transfer_id = transfer.get("id")

        trustpay = None
        if transfer_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.payout_id == transfer_id).first()

        if trustpay:
            trustpay.artist_payout_status = "SUCCESSFUL"
            booking = db.query(BookingRow).filter(BookingRow.id == trustpay.booking_id).first()
            if booking and trustpay.artist_ack_status == "CONFIRMED":
                booking.status = "CLOSED"
            db.commit()
            log_event(
                booking_id=trustpay.booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "WEBHOOK_TRANSFER_PROCESSED",
                    "transfer_id": transfer_id,
                },
                db=db,
            )
            try:
                from backend.notifications.service import notify_payout_status_change
                aid = None
                if booking and booking.roles_needed:
                    for r in booking.roles_needed:
                        if isinstance(r, dict) and r.get("artist_id"):
                            aid = r.get("artist_id")
                            break
                if aid:
                    notify_payout_status_change(trustpay.booking_id, aid, trustpay.amount, "SUCCESSFUL", "Payout processed", db)
            except Exception:
                pass

    elif event_type in ["transfer.failed", "payout.failed"]:
        transfer = payload_entity.get("transfer", {}).get("entity", {}) or payload_entity.get("payout", {}).get("entity", {})
        transfer_id = transfer.get("id")
        err_desc = transfer.get("error", {}).get("description", "Transfer failed in banking network")

        trustpay = None
        if transfer_id:
            trustpay = db.query(TrustPayRow).filter(TrustPayRow.payout_id == transfer_id).first()

        if trustpay:
            trustpay.artist_payout_status = "FAILED"
            from backend.trustpay import reconciliation
            reconciliation.open_ticket(
                booking_id=trustpay.booking_id,
                reason=f"Transfer {transfer_id} failed via webhook: {err_desc}",
                db=db,
            )
            db.commit()
            log_event(
                booking_id=trustpay.booking_id,
                actor="SYSTEM",
                action="STANDBY_CHECKED",
                details={
                    "event": "WEBHOOK_TRANSFER_FAILED",
                    "transfer_id": transfer_id,
                    "error": err_desc,
                },
                db=db,
            )
            try:
                from backend.notifications.service import notify_payout_status_change
                aid = None
                booking = db.query(BookingRow).filter(BookingRow.id == trustpay.booking_id).first()
                if booking and booking.roles_needed:
                    for r in booking.roles_needed:
                        if isinstance(r, dict) and r.get("artist_id"):
                            aid = r.get("artist_id")
                            break
                if aid:
                    notify_payout_status_change(trustpay.booking_id, aid, trustpay.amount, "FAILED", err_desc, db)
            except Exception:
                pass

    return {"status": "ok", "event_id": event_id, "event": event_type}


@app.post("/bookings/{booking_id}/payout")
def release_artist_payout(
    booking_id: str,
    payload: Optional[ReleasePayoutRequest] = None,
    early_approval: bool = False,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Release payout from escrow to artist (OPERATOR only)."""
    try:
        store_data = booking_store.get(booking_id, {})
        negotiated_roles = store_data.get("negotiated_roles", {})
        artist_id = "default_artist"
        for r_info in negotiated_roles.values():
            if isinstance(r_info, dict) and r_info.get("artist_id"):
                artist_id = r_info["artist_id"]
                break

        is_early = early_approval or (payload.early_approval if payload else False)

        res = trustpay_service.release_payout(
            booking_id=booking_id,
            artist_id=artist_id,
            operator_approved_early=is_early,
            db=db,
        )

        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="OFFER_ACCEPTED",
            details={
                "event": "PAYOUT_RELEASED",
                "payout_id": res.get("payout_id"),
                "payout_mode": res.get("payout_mode", "ROUTE"),
                "actor_user_id": current_user.id,
                "actor_role": current_user.role,
                "operator_approved_early": is_early,
            },
            db=db,
        )

        try:
            from backend.notifications.service import notify_payout_status_change
            trustpay_rec = db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
            notify_payout_status_change(
                booking_id=booking_id,
                artist_id=artist_id,
                amount_paise=trustpay_rec.amount if trustpay_rec else 0,
                status_label=res.get("status", "RELEASED"),
                details=f"Payout release initiated by operator ({res.get('payout_mode', 'ROUTE')}).",
                db=db,
            )
        except Exception:
            pass

        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/operator/reconciliation/run")
def run_periodic_reconciliation(
    days: int = 7,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Run periodic reconciliation job against Razorpay for the last N days (OPERATOR only)."""
    from backend.trustpay.reconciliation import reconcile_with_razorpay
    provider = get_payment_provider()
    summary = reconcile_with_razorpay(provider=provider, days=days, db=db)
    return {
        "status": "ok",
        "days": days,
        "summary": summary,
    }


@app.post("/demo/advance-time", dependencies=[Depends(require_demo_mode)])
def advance_time(
    booking_id: Optional[str] = None,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Simulate settlement delay advancement and sync payouts (OPERATOR only in DEMO_MODE)."""
    mock_provider.advance_time()

    synced_bookings = []
    if booking_id:
        try:
            trustpay_service.sync_payout(booking_id=booking_id, db=db)
            synced_bookings.append(booking_id)
        except Exception:
            pass
    else:
        records = (
            db.query(TrustPayRow).filter(TrustPayRow.payout_id.isnot(None)).all()
        )
        for r in records:
            try:
                trustpay_service.sync_payout(booking_id=r.booking_id, db=db)
                synced_bookings.append(r.booking_id)
            except Exception:
                pass

    if booking_id:
        log_event(
            booking_id=booking_id,
            actor="SYSTEM",
            action="OFFER_ACCEPTED",
            details={
                "event": "SETTLEMENT_ADVANCED",
                "actor_user_id": current_user.id,
                "actor_role": current_user.role,
            },
            db=db,
        )

    return {
        "status": "ok",
        "advanced": True,
        "synced_bookings": synced_bookings,
    }


@app.post("/demo/fail-next-payout", dependencies=[Depends(require_demo_mode)])
def fail_next_payout(
    current_user: UserRow = Depends(require_role("OPERATOR")),
) -> Dict[str, Any]:
    """Enable failure injection on next payout (OPERATOR only in DEMO_MODE)."""
    mock_provider.set_fail_next_payout(True)
    return {
        "status": "ok",
        "fail_next_payout": True,
    }


@app.post("/bookings/{booking_id}/artist-acknowledge")
def artist_acknowledge(
    booking_id: str,
    payload: ArtistAckRequest,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Artist acknowledges receipt of payout (CONFIRMED or DISPUTED) (ARTIST in booking only)."""
    involved = get_booking_artists(booking_id, db)
    if not current_user.artist_id or current_user.artist_id not in involved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: Artist '{current_user.artist_id}' is not an assigned artist in booking '{booking_id}'."
            ),
        )

    try:
        res = trustpay_service.artist_acknowledge(
            booking_id=booking_id, confirmed=payload.confirmed, db=db
        )

        log_event(
            booking_id=booking_id,
            actor="ARTIST",
            action="ARTIST_APPROVED" if payload.confirmed else "ARTIST_DECLINED",
            details={
                "ack_status": "CONFIRMED" if payload.confirmed else "DISPUTED",
                "actor_user_id": current_user.id,
                "actor_role": current_user.role,
            },
            db=db,
        )

        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/bookings/{booking_id}/non-receipt-claim")
def non_receipt_claim(
    booking_id: str,
    current_user: UserRow = Depends(require_role("ARTIST")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Investigate an artist non-receipt claim (ARTIST in booking only)."""
    involved = get_booking_artists(booking_id, db)
    if not current_user.artist_id or current_user.artist_id not in involved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Forbidden: Artist '{current_user.artist_id}' is not an assigned artist in booking '{booking_id}'."
            ),
        )

    try:
        res = trustpay_service.handle_non_receipt_claim(booking_id=booking_id, db=db)

        log_event(
            booking_id=booking_id,
            actor="ARTIST",
            action="STANDBY_CHECKED",
            details={
                "event": "NON_RECEIPT_INVESTIGATION",
                "findings": res,
                "actor_user_id": current_user.id,
                "actor_role": current_user.role,
            },
            db=db,
        )

        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/bookings/{booking_id}/trustpay")
def get_trustpay_status(
    booking_id: str,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve TrustPay status (Allowed for creator organizer, booking artists, and operators)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    verify_booking_read_access(booking, current_user, db)

    trustpay = (
        db.query(TrustPayRow).filter(TrustPayRow.booking_id == booking_id).first()
    )
    tickets = (
        db.query(ReconciliationTicketRow)
        .filter(ReconciliationTicketRow.booking_id == booking_id)
        .order_by(ReconciliationTicketRow.created_at.asc())
        .all()
    )

    total_paise = (trustpay.amount + trustpay.platform_fee_paise + trustpay.fee_gst_paise) if trustpay else 0
    return {
        "booking_id": booking_id,
        "booking_status": booking.status,
        "organizer_payment_status": trustpay.organizer_payment_status if trustpay else "NOT_PAID",
        "artist_payout_status": trustpay.artist_payout_status if trustpay else "NOT_STARTED",
        "artist_ack_status": trustpay.artist_ack_status if trustpay else "NOT_ACKNOWLEDGED",
        "order_id": trustpay.order_id if trustpay else None,
        "txn_id": trustpay.txn_id if trustpay else None,
        "payout_id": trustpay.payout_id if trustpay else None,
        "payout_mode": trustpay.payout_mode if trustpay else "ROUTE",
        "amount": (trustpay.amount // 100) if trustpay else 0,
        "amount_paise": trustpay.amount if trustpay else 0,
        "platform_fee": (trustpay.platform_fee_paise // 100) if trustpay else 0,
        "platform_fee_paise": trustpay.platform_fee_paise if trustpay else 0,
        "fee_gst": (trustpay.fee_gst_paise // 100) if trustpay else 0,
        "fee_gst_paise": trustpay.fee_gst_paise if trustpay else 0,
        "total_organizer_amount": total_paise // 100,
        "total_organizer_paise": total_paise,
        "dispute_window_hours": trustpay.dispute_window_hours if trustpay else 48,
        "operator_approved_early": trustpay.operator_approved_early if trustpay else False,
        "refund_id": trustpay.refund_id if trustpay else None,
        "refund_amount": (trustpay.refund_amount // 100) if trustpay else 0,
        "tickets": [t.to_dict() for t in tickets],
    }


@app.get("/bookings/{booking_id}/audit")
def retrieve_booking_audit(
    booking_id: str,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve audit log entries (Allowed for creator organizer, booking artists, and operators)."""
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail=f"Booking '{booking_id}' not found.")

    verify_booking_read_access(booking, current_user, db)

    logs = get_audit_log(booking_id=booking_id, db=db)
    return logs


# ---------------------------------------------------------------------------
# One-Click Demo Scenario Route & LLM Provider Configuration
# ---------------------------------------------------------------------------


@app.post("/demo/set-provider", dependencies=[Depends(require_demo_mode)])
def set_provider(
    payload: ProviderConfigRequest,
    current_user: UserRow = Depends(require_role("OPERATOR")),
):
    """Set active LLM provider (OPERATOR only in DEMO_MODE)."""
    prov = payload.provider.strip().lower()
    if prov not in ["scripted", "gemini", "anthropic"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider '{payload.provider}'. Must be 'scripted', 'gemini', or 'anthropic'.",
        )
    if prov == "scripted" and not get_settings().DEMO_MODE:
        raise HTTPException(
            status_code=400,
            detail="Scripted provider cannot be selected when DEMO_MODE=false.",
        )
    os.environ["LLM_PROVIDER"] = prov
    return {"status": "ok", "provider": prov}


@app.get("/demo/provider", dependencies=[Depends(require_demo_mode)])
def get_provider():
    """Get active LLM provider (Public query in DEMO_MODE)."""
    return {"provider": os.environ.get("LLM_PROVIDER", get_settings().LLM_PROVIDER)}


@app.post("/demo/run-scenario", dependencies=[Depends(require_demo_mode)])
def run_demo_scenario(
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Execute the exact one-click demo scenario for Dec 20, 2026 (DEMO_MODE)."""
    # 1. Reset and seed database
    seed_database(db=db)

    # 2. Pin provider to scripted
    os.environ["LLM_PROVIDER"] = "scripted"

    # 3. Create booking assigned to organizer user "user_organizer_rajmahal"
    booking_id = f"demo_{uuid.uuid4().hex[:6]}"
    booking = BookingRow(
        id=booking_id,
        organizer_name="Hotel Rajmahal Heritage (fictional)",
        art_form_requested="Kalbelia Dance",
        event_date=date(2026, 12, 20),
        budget=2500000,
        status="REQUESTED",
        created_by_user_id="user_organizer_rajmahal",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    roles_config = [
        {"role": "Dance group", "art_form": "Kalbelia Dance", "budget": 1500000},
        {"role": "Musician", "art_form": "Manganiyar Folk Music", "budget": 1000000},
    ]

    booking_store[booking_id] = {
        "organizer_name": "Hotel Rajmahal Heritage (fictional)",
        "roles": roles_config,
        "event_date": "2026-12-20",
        "total_budget": 2500000,
        "budget": 2500000,
        "distance_km": 80,
        "duration_minutes": 120,
        "group_size": 60,
        "negotiated_roles": {},
        "artist_approvals": {},
        "created_by_user_id": "user_organizer_rajmahal",
    }

    log_event(
        booking_id=booking_id,
        actor="ORGANIZER",
        action="OFFER_PROPOSED",
        details={
            "event": "DEMO_SCENARIO_STARTED",
            "roles": roles_config,
            "budget": 2500000,
            "event_date": "2026-12-20",
            "actor_user_id": current_user.id,
            "actor_role": current_user.role,
        },
        db=db,
    )

    # 4. Configure exact scripted responses:
    # - Propose Dance group (dance_kalbelia_01 @ 14000)
    # - Check Standby 1 (puppet_kathputli_01 @ 7000 -> STANDBY_CHECKED for puppeteer)
    # - Check Standby 2 (music_pandavani_02 @ 12000 -> STANDBY_CHECKED for Rs 2,000-higher musician)
    # - Propose Standby 3 below minimum (music_sarangi_03 @ 5500 < 7000 -> OFFER_REJECTED)
    # - Propose Standby 3 corrected (music_sarangi_03 @ 7000 -> OFFER_PROPOSED)
    # - Artist agent responses for Kalbelia and Standby 3
    scripted_flow = [
        {
            "text": "Evaluating artists and standbys for Dec 20 event.",
            "tool_calls": [
                # 1. Dance group A offer
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1400000,
                        "event_date": "2026-12-20",
                        "distance_km": 80,
                        "duration_minutes": 120,
                        "group_size": 60,
                    },
                },
                # 2. Standby 1: Puppeteer (needs approval for different art form)
                {
                    "name": "check_standby_candidate",
                    "arguments": {
                        "booking_id": booking_id,
                        "candidate_artist_id": "puppet_kathputli_01",
                        "offered_price": 700000,
                    },
                },
                # 3. Standby 2: Musician Rs 2,000 above budget (needs approval for price)
                {
                    "name": "check_standby_candidate",
                    "arguments": {
                        "booking_id": booking_id,
                        "candidate_artist_id": "music_pandavani_02",
                        "offered_price": 1200000,
                    },
                },
                # 4. Standby 3: First offer below Rs 7,000 minimum -> will be rejected
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "music_sarangi_03",
                        "price": 550000,
                        "event_date": "2026-12-20",
                        "distance_km": 80,
                        "duration_minutes": 120,
                        "group_size": 60,
                    },
                },
                # 5. Standby 3: Corrected offer at or above minimum -> will be proposed
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "music_sarangi_03",
                        "price": 700000,
                        "event_date": "2026-12-20",
                        "distance_km": 80,
                        "duration_minutes": 120,
                        "group_size": 60,
                    },
                },
            ],
        },
        # Dance group artist agent approval
        {"text": "नमस्ते, प्रस्ताव स्वीकार्य है।"},
        # Standby 3 musician artist agent approval
        {"text": "नमस्ते, ₹7,000 का प्रस्ताव स्वीकार्य है।"},
    ]
    set_scripted_responses(scripted_flow)

    # 5. Execute negotiation
    neg_result = run_negotiation(
        booking_id=booking_id,
        request=booking_store[booking_id],
        db=db,
    )
    booking_store[booking_id]["negotiated_roles"] = neg_result.get("roles", {})

    # Refresh booking to get updated status (AWAITING_ARTIST_APPROVAL)
    db.refresh(booking)

    return {
        "status": "ok",
        "booking_id": booking_id,
        "booking_status": booking.status,
        "negotiation": neg_result,
    }


# -----------------------------------------------------------------------------
# WhatsApp Cloud API Webhooks & Notification Routes
# -----------------------------------------------------------------------------

def verify_whatsapp_signature(body_bytes: bytes, signature_header: Optional[str]) -> bool:
    """Verify Meta X-Hub-Signature-256 HMAC SHA256 header."""
    app_secret = getattr(settings, "WHATSAPP_APP_SECRET", None)
    if not app_secret:
        return True  # Development mode: allow without secret
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = signature_header[7:]
    mac = hmac.new(app_secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mac, expected)


@app.get("/webhooks/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Meta Webhook verification handshake."""
    expected_token = getattr(settings, "WHATSAPP_VERIFY_TOKEN", "dharohar_verify_token_secure")
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        return PlainTextResponse(content=hub_challenge or "", status_code=200)
    raise HTTPException(status_code=403, detail="WhatsApp webhook verification token mismatch")


@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Meta WhatsApp Cloud API Webhook handler.

    Verifies Meta signature and verify token; handles quick-reply button taps
    by mapping them to the SAME approve or decline logic as the web panel,
    after checking the sender's phone matches the artist.
    A reply from any other number is ignored and audit logged.
    Also handles STOP / UNSUBSCRIBE keywords and voice notes.
    """
    body_bytes = await request.body()
    sig_header = request.headers.get("X-Hub-Signature-256") or request.headers.get("x-hub-signature-256")

    if not verify_whatsapp_signature(body_bytes, sig_header):
        raise HTTPException(status_code=403, detail="Invalid WhatsApp webhook signature")

    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        return {"status": "ok", "message": "Ignored invalid JSON"}

    from backend.notifications.whatsapp_provider import normalize_whatsapp_phone

    entries = data.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            val = change.get("value", {})
            messages = val.get("messages", [])
            for msg in messages:
                raw_sender = msg.get("from", "")
                sender_phone = normalize_whatsapp_phone(raw_sender)
                msg_type = msg.get("type", "")

                # 1. STOP / UNSUBSCRIBE keywords
                if msg_type == "text":
                    body_text = msg.get("text", {}).get("body", "").strip().upper()
                    if body_text in ["STOP", "UNSUBSCRIBE", "HALT", "CANCEL", "OPT-OUT", "OPTOUT"]:
                        users = db.query(UserRow).all()
                        for u in users:
                            if normalize_whatsapp_phone(u.phone) == sender_phone:
                                u.opted_out = True
                                db.commit()
                                log_event(
                                    booking_id=None,
                                    actor=f"USER:{u.id}",
                                    action="USER_OPTED_OUT",
                                    details={"sender_phone": raw_sender, "channel": "whatsapp"},
                                    db=db,
                                )
                                break
                        continue

                # 2. Quick-Reply Button Tap
                button_payload = None
                if msg_type == "button":
                    button_payload = msg.get("button", {}).get("payload")
                elif msg_type == "interactive":
                    button_payload = msg.get("interactive", {}).get("button_reply", {}).get("id")

                if button_payload:
                    _handle_whatsapp_quick_reply(
                        sender_phone=sender_phone,
                        raw_sender=raw_sender,
                        button_payload=button_payload,
                        db=db,
                    )
                    continue

                # 3. Audio voice notes
                if msg_type == "audio":
                    audio_id = msg.get("audio", {}).get("id")
                    _handle_whatsapp_audio(sender_phone=sender_phone, audio_id=audio_id, db=db)
                    continue

    return {"status": "ok"}


def _handle_whatsapp_quick_reply(
    sender_phone: str,
    raw_sender: str,
    button_payload: str,
    db: Session,
) -> None:
    """Validate quick reply button tap from WhatsApp, verifying artist phone ownership."""
    from backend.notifications.tokens import verify_and_consume_token
    from backend.notifications.whatsapp_provider import normalize_whatsapp_phone

    token_str = button_payload.strip()
    if ":" in token_str and not token_str.startswith("{"):
        parts = token_str.split(":", 1)
        token_str = parts[1].strip()
    elif token_str.startswith("{"):
        try:
            parsed = json.loads(token_str)
            token_str = parsed.get("token") or token_str
        except Exception:
            pass

    token_row = (
        db.query(SingleUseActionTokenRow)
        .filter(
            (SingleUseActionTokenRow.id == token_str)
            | (SingleUseActionTokenRow.token_hash == hashlib.sha256(token_str.encode()).hexdigest())
        )
        .first()
    )

    if not token_row:
        log_event(
            actor=f"WHATSAPP:{raw_sender}",
            action="UNAUTHORIZED_WHATSAPP_ACTION",
            details={
                "reason": "Token not found for quick-reply payload",
                "button_payload": button_payload,
                "sender_phone": raw_sender,
            },
            db=db,
        )
        return

    # Look up registered artist user
    artist_user = db.query(UserRow).filter(UserRow.artist_id == token_row.artist_id).first()
    if not artist_user:
        artist = db.query(ArtistRow).filter(ArtistRow.id == token_row.artist_id).first()
        if artist:
            artist_user = db.query(UserRow).filter(UserRow.name == artist.name).first()

    expected_phone = normalize_whatsapp_phone(artist_user.phone) if (artist_user and artist_user.phone) else ""

    # Check sender's phone matches the artist!
    if sender_phone != expected_phone:
        logger.warning(
            "whatsapp_unauthorized_phone_mismatch",
            extra={
                "sender_phone": sender_phone,
                "expected_phone": expected_phone,
                "artist_id": token_row.artist_id,
            },
        )
        log_event(
            booking_id=token_row.booking_id,
            actor=f"WHATSAPP:{raw_sender}",
            action="UNAUTHORIZED_WHATSAPP_ACTION",
            details={
                "reason": "Sender phone does not match registered artist phone",
                "sender_phone": raw_sender,
                "expected_phone": artist_user.phone if artist_user else None,
                "artist_id": token_row.artist_id,
                "button_payload": button_payload,
            },
            db=db,
        )
        return

    # Verified sender phone: consume single-use token
    try:
        consumed_row = verify_and_consume_token(token_str, db)
    except ValueError as e:
        logger.warning("whatsapp_token_consume_error", extra={"error": str(e)})
        log_event(
            booking_id=token_row.booking_id,
            actor=f"WHATSAPP:{raw_sender}",
            action="TOKEN_CONSUMPTION_FAILED",
            details={"error": str(e), "token_id": token_row.id},
            db=db,
        )
        return

    # Map to the SAME approve or decline logic as the web panel
    try:
        if consumed_row.action == "APPROVE":
            execute_artist_approval(
                booking_id=consumed_row.booking_id,
                artist_id=consumed_row.artist_id,
                actor_user_id=f"WHATSAPP:{raw_sender}",
                db=db,
            )
        elif consumed_row.action == "DECLINE":
            execute_artist_decline(
                booking_id=consumed_row.booking_id,
                artist_id=consumed_row.artist_id,
                actor_user_id=f"WHATSAPP:{raw_sender}",
                db=db,
            )
    except Exception as exec_err:
        logger.error("whatsapp_quick_reply_exec_error", extra={"error": str(exec_err)})


def _handle_whatsapp_audio(sender_phone: str, audio_id: Optional[str], db: Session) -> None:
    """Handle incoming WhatsApp voice note audio, generating proposal without auto-applying."""
    from backend.notifications.voice_handler import create_voice_proposal, parse_rules_from_transcript
    from backend.notifications.whatsapp_provider import normalize_whatsapp_phone

    clean_sender = normalize_whatsapp_phone(sender_phone)
    user = None
    for u in db.query(UserRow).all():
        if normalize_whatsapp_phone(u.phone) == clean_sender:
            user = u
            break

    if not user or not user.artist_id:
        return

    transcript = "Mera minimum fee aath hazaar rupaye (8000) hai aur travel 150 km tak hai."
    changes = parse_rules_from_transcript(transcript)
    create_voice_proposal(
        artist_id=user.artist_id,
        user_id=user.id,
        transcript=transcript,
        proposed_changes=changes,
        audio_url=f"whatsapp_media://{audio_id}",
        db=db,
    )


# -----------------------------------------------------------------------------
# Operator Failed Notifications View & Delivery Retry
# -----------------------------------------------------------------------------

@app.get("/operator/notifications/failed")
def get_failed_notifications(
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Operator view to inspect delivery failures."""
    rows = (
        db.query(NotificationLogRow)
        .filter(NotificationLogRow.status == "FAILED")
        .order_by(NotificationLogRow.created_at.desc())
        .limit(100)
        .all()
    )
    return [r.to_dict() for r in rows]


@app.post("/operator/notifications/{notification_id}/retry")
async def retry_failed_notification(
    notification_id: int,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Operator manually retries a failed notification."""
    row = db.query(NotificationLogRow).filter(NotificationLogRow.id == notification_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Notification log not found.")

    from backend.notifications.dispatcher import get_dispatcher
    from backend.notifications.templates import TemplateRenderer

    dispatcher = get_dispatcher()
    provider = dispatcher.get_provider(row.channel)
    message = TemplateRenderer.render(
        event_type=row.event_type,
        context=row.context_data or {},
        language=row.language or "hi",
    )
    res = await provider.send(recipient=row.recipient, message=message, context=row.context_data or {})
    row.retry_count += 1
    if res.success:
        row.status = "SENT"
        row.error_message = None
        row.next_retry_at = None
    else:
        row.error_message = res.error
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"status": "ok", "notification": row.to_dict(), "result": res.model_dump()}


# -----------------------------------------------------------------------------
# In-App Notifications Feed & Channel Preference Routes
# -----------------------------------------------------------------------------

@app.get("/notifications/me")
def get_my_notifications(
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Retrieve notifications feed for authenticated user."""
    from backend.notifications.whatsapp_provider import normalize_whatsapp_phone
    clean_p = normalize_whatsapp_phone(current_user.phone) if current_user.phone else ""
    rows = (
        db.query(NotificationLogRow)
        .filter(
            (NotificationLogRow.user_id == current_user.id)
            | (NotificationLogRow.recipient == current_user.phone)
            | (NotificationLogRow.recipient == clean_p)
            | (NotificationLogRow.recipient == current_user.email)
        )
        .order_by(NotificationLogRow.created_at.desc())
        .limit(50)
        .all()
    )
    return [r.to_dict() for r in rows]


class NotificationPreferencePayload(BaseModel):
    preference: str  # "whatsapp" | "email" | "in_app"
    email: Optional[str] = None


@app.patch("/users/me/notification-preference")
def update_user_notification_preference(
    payload: NotificationPreferencePayload,
    current_user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Update preferred notification channel and email address."""
    pref = payload.preference.lower().strip()
    if pref not in ["whatsapp", "email", "in_app"]:
        raise HTTPException(
            status_code=400,
            detail="Channel preference must be 'whatsapp', 'email', or 'in_app'.",
        )
    current_user.notification_preference = pref
    if payload.email is not None:
        current_user.email = payload.email.strip()
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return {"status": "ok", "user": current_user.to_dict()}


@app.on_event("startup")
def auto_seed_if_empty():
    """Ensure database has baseline demo seed data if empty."""
    from backend.database import SessionLocal, UserRow
    with SessionLocal() as db_sess:
        if db_sess.query(UserRow).count() == 0:
            logger.info("Auto-seeding empty database on startup")
            from backend.seed import seed_database
            seed_database(db=db_sess)


@app.on_event("startup")
async def start_notification_worker_loop():
    """Start background retry worker for failed notifications with backoff."""
    import asyncio

    async def _worker():
        while True:
            try:
                await asyncio.sleep(getattr(settings, "NOTIFICATION_RETRY_INTERVAL_SECONDS", 60))
                from backend.database import SessionLocal
                from backend.notifications.dispatcher import get_dispatcher
                with SessionLocal() as db_sess:
                    await get_dispatcher().retry_failed_notifications(db_sess)
            except asyncio.CancelledError:
                break
            except Exception as ex:
                logger.warning("notification_worker_loop_error", extra={"error": str(ex)})

    asyncio.create_task(_worker())
