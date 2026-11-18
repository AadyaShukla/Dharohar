"""Organizer profile management, verification endpoints, and operator queues."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.audit import log_event
from backend.auth import get_current_user, require_role
from backend.database import OrganizerProfileRow, UserRow, get_db

organizer_router = APIRouter(tags=["organizers"])

VALID_ORG_TYPES = ["hotel", "school", "corporate", "tour operator", "individual"]


class OrganizerProfileUpdateRequest(BaseModel):
    organization_name: str = Field(..., min_length=2, max_length=150)
    org_type: str = Field(..., description="hotel|school|corporate|tour operator|individual")
    gst_number: Optional[str] = None
    work_email: Optional[str] = None


@organizer_router.get("/organizer/profile")
def get_organizer_profile(
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retrieve the authenticated organizer's organization profile."""
    profile = (
        db.query(OrganizerProfileRow)
        .filter(OrganizerProfileRow.user_id == current_user.id)
        .first()
    )
    if not profile:
        # Create an unverified profile record if missing
        org_id = f"org_prof_{uuid.uuid4().hex[:8]}"
        profile = OrganizerProfileRow(
            id=org_id,
            user_id=current_user.id,
            organization_name=current_user.name,
            org_type="individual",
            verification_status="UNVERIFIED",
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile.to_dict()


@organizer_router.post("/organizer/profile")
def update_organizer_profile(
    payload: OrganizerProfileUpdateRequest,
    current_user: UserRow = Depends(require_role("ORGANIZER")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create or update organization details for the authenticated organizer."""
    norm_type = payload.org_type.strip().lower()
    if norm_type not in VALID_ORG_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid org_type '{payload.org_type}'. Must be one of {VALID_ORG_TYPES}.",
        )

    profile = (
        db.query(OrganizerProfileRow)
        .filter(OrganizerProfileRow.user_id == current_user.id)
        .first()
    )
    if not profile:
        profile = OrganizerProfileRow(
            id=f"org_prof_{uuid.uuid4().hex[:8]}",
            user_id=current_user.id,
            organization_name=payload.organization_name.strip(),
            org_type=norm_type,
            gst_number=payload.gst_number.strip() if payload.gst_number else None,
            work_email=payload.work_email.strip() if payload.work_email else None,
            verification_status="UNVERIFIED",
        )
        db.add(profile)
    else:
        profile.organization_name = payload.organization_name.strip()
        profile.org_type = norm_type
        profile.gst_number = payload.gst_number.strip() if payload.gst_number else None
        profile.work_email = payload.work_email.strip() if payload.work_email else None
        profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)

    log_event(
        booking_id=None,
        actor="ORGANIZER",
        action="ORGANIZER_PROFILE_UPDATED",
        details={
            "user_id": current_user.id,
            "organization_name": profile.organization_name,
            "org_type": profile.org_type,
            "verification_status": profile.verification_status,
        },
        db=db,
    )

    return {
        "status": "ok",
        "message": "Organizer profile updated successfully.",
        "profile": profile.to_dict(),
    }


@organizer_router.post("/operator/organizers/{identifier}/verify")
def verify_organizer_profile(
    identifier: str,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Operator approves and verifies an organizer's profile (enables bookings > Rs 20,000)."""
    profile = (
        db.query(OrganizerProfileRow)
        .filter(
            (OrganizerProfileRow.id == identifier)
            | (OrganizerProfileRow.user_id == identifier)
        )
        .first()
    )
    if not profile:
        # Check if user exists
        user = db.query(UserRow).filter(UserRow.id == identifier).first()
        if user and user.role == "ORGANIZER":
            profile = OrganizerProfileRow(
                id=f"org_prof_{uuid.uuid4().hex[:8]}",
                user_id=user.id,
                organization_name=user.name,
                org_type="individual",
                verification_status="VERIFIED",
            )
            db.add(profile)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Organizer profile for '{identifier}' not found.",
            )

    profile.verification_status = "VERIFIED"
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    log_event(
        booking_id=None,
        actor="OPERATOR",
        action="ORGANIZER_VERIFIED",
        details={
            "operator_id": current_user.id,
            "organizer_user_id": profile.user_id,
            "profile_id": profile.id,
            "organization_name": profile.organization_name,
        },
        db=db,
    )

    return {
        "status": "ok",
        "message": f"Organizer '{profile.organization_name}' has been verified.",
        "profile": profile.to_dict(),
    }


@organizer_router.get("/operator/organizers")
def list_organizers_for_operator(
    verification_status: Optional[str] = None,
    current_user: UserRow = Depends(require_role("OPERATOR")),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List organizers for operator review."""
    query = db.query(OrganizerProfileRow)
    if verification_status:
        query = query.filter(
            OrganizerProfileRow.verification_status == verification_status.strip().upper()
        )
    profiles = query.order_by(OrganizerProfileRow.created_at.desc()).all()

    out = []
    for p in profiles:
        user = db.query(UserRow).filter(UserRow.id == p.user_id).first()
        d = p.to_dict()
        d["user_name"] = user.name if user else "Organizer"
        d["phone"] = user.phone if user else ""
        out.append(d)
    return out
