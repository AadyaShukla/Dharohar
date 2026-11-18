"""Authentication, Firebase phone identity verification, and role-based access control for Dharohar."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import os
import random
from typing import Any, Callable, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
import jwt
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from backend.database import (
    ConsentRow,
    OrganizerProfileRow,
    OtpRow,
    TokenBlacklistRow,
    UserRow,
    get_db,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)
limiter = Limiter(key_func=get_remote_address)


# -----------------------------------------------------------------------------
# Configuration & Helpers
# -----------------------------------------------------------------------------

def get_auth_secret() -> str:
    """Retrieve secret key for HS256 signing from environment/settings. Never logs secret."""
    from backend.config import get_settings
    return get_settings().AUTH_SECRET


def is_demo_mode() -> bool:
    """Check if DEMO_MODE is active (defaults to False in config)."""
    from backend.config import get_settings
    return get_settings().DEMO_MODE


def require_demo_mode() -> None:
    """Enforce that simulated OTP endpoints are available only in demo mode."""
    if not is_demo_mode():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulated OTP endpoints are disabled when DEMO_MODE=false.",
        )


def hash_otp(code: str, phone: str) -> str:
    """Generate SHA-256 digest for OTP."""
    data = f"{phone}:{code}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def normalize_phone(phone: str) -> str:
    """Extract standard digits for phone matching."""
    clean = "".join(ch for ch in phone if ch.isdigit())
    if len(clean) >= 10:
        return clean[-10:]
    return clean


def find_user_by_phone(db: Session, raw_phone: str) -> Optional[UserRow]:
    """Find user by phone number, matching E.164, raw input, or standard 10 digits."""
    clean_raw = raw_phone.strip()
    norm = normalize_phone(clean_raw)
    return (
        db.query(UserRow)
        .filter(
            (UserRow.phone == clean_raw)
            | (UserRow.phone == norm)
            | (UserRow.phone == f"+91{norm}")
        )
        .first()
    )


def create_session_token(
    user: UserRow,
    expires_delta: timedelta = timedelta(hours=2),
) -> str:
    """Generate a short-lived HS256 JWT session token with user_id, role, and unique jti."""
    now = datetime.now(timezone.utc)
    token_payload = {
        "jti": uuid.uuid4().hex,
        "sub": user.id,
        "user_id": user.id,
        "name": user.name,
        "role": user.role,
        "artist_id": user.artist_id,
        "language": getattr(user, "language", "hi") or "hi",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(token_payload, get_auth_secret(), algorithm="HS256")


# -----------------------------------------------------------------------------
# Firebase Identity Verification
# -----------------------------------------------------------------------------

_firebase_initialized = False


def _init_firebase() -> None:
    """Initialize Firebase Admin SDK if not already initialized."""
    global _firebase_initialized
    if _firebase_initialized:
        return

    if not firebase_admin._apps:
        from backend.config import get_settings
        cred_path = get_settings().FIREBASE_CREDENTIALS_PATH
        if cred_path and os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            except Exception:
                pass
        else:
            try:
                firebase_admin.initialize_app()
            except Exception:
                pass
    _firebase_initialized = True


def verify_identity(id_token: str) -> str:
    """Verify a Firebase ID token and return the verified phone number.

    Raises HTTPException(401) on invalid/expired token or missing phone number.
    """
    if not id_token or not id_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or empty Firebase ID token.",
        )

    try:
        _init_firebase()
        decoded = firebase_auth.verify_id_token(id_token.strip())
        phone = decoded.get("phone_number")
        if not phone:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firebase ID token does not contain a verified phone number.",
            )
        return phone
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Firebase ID token: {str(e)}",
        )


# -----------------------------------------------------------------------------
# Request / Response Schemas
# -----------------------------------------------------------------------------

class SessionRequest(BaseModel):
    id_token: str


class RegisterRequest(BaseModel):
    id_token: str
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., description="Must be ORGANIZER or ARTIST")
    language: Optional[str] = "hi"
    terms_version: Optional[str] = "1.0"
    privacy_version: Optional[str] = "1.0"
    organization_name: Optional[str] = None
    org_type: Optional[str] = "individual"
    gst_number: Optional[str] = None
    work_email: Optional[str] = None


class OtpRequest(BaseModel):
    phone: str


class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str


# -----------------------------------------------------------------------------
# Primary Authentication Endpoints
# -----------------------------------------------------------------------------

@auth_router.post("/session")
@limiter.limit("60/minute")
def create_session(
    request: Request,
    payload: SessionRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Verify Firebase ID token and issue a short-lived session token.

    If the phone is not yet registered, returns 404 with detail 'Not registered'.
    """
    phone = verify_identity(payload.id_token)
    user = find_user_by_phone(db, phone)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not registered",
        )

    token = create_session_token(user, expires_delta=timedelta(hours=2))
    user_dict = user.to_dict()
    if user.role == "ORGANIZER":
        org_prof = db.query(OrganizerProfileRow).filter(OrganizerProfileRow.user_id == user.id).first()
        user_dict["organizer_profile"] = org_prof.to_dict() if org_prof else None

    return {
        "status": "ok",
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict,
    }


@auth_router.post("/register")
@limiter.limit("30/minute")
def register_user(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Register a new user account (ORGANIZER or ARTIST only) and record legal consent.

    OPERATOR accounts can never self-register.
    """
    role = payload.role.strip().upper()
    if role not in ["ORGANIZER", "ARTIST"]:
        if role == "OPERATOR":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OPERATOR accounts can never self-register.",
            )
        if role == "COORDINATOR":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="COORDINATOR accounts can never self-register.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be 'ORGANIZER' or 'ARTIST'.",
        )

    phone = verify_identity(payload.id_token)
    clean_phone = normalize_phone(phone)

    # Check for existing user
    existing = find_user_by_phone(db, phone)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number is already registered. Please log in.",
        )

    user_id = f"user_{role.lower()}_{uuid.uuid4().hex[:8]}"
    new_user = UserRow(
        id=user_id,
        name=payload.name.strip(),
        phone=clean_phone,
        role=role,
        language=payload.language or "hi",
        artist_id=None,
    )
    db.add(new_user)
    db.flush()

    # Record mandatory legal consent
    consent = ConsentRow(
        user_id=new_user.id,
        terms_version=payload.terms_version or "1.0",
        privacy_version=payload.privacy_version or "1.0",
        consented_at=datetime.utcnow(),
    )
    db.add(consent)

    org_prof_dict = None
    if role == "ORGANIZER":
        org_id = f"org_prof_{uuid.uuid4().hex[:8]}"
        org_prof = OrganizerProfileRow(
            id=org_id,
            user_id=new_user.id,
            organization_name=(payload.organization_name or payload.name).strip(),
            org_type=payload.org_type or "individual",
            gst_number=payload.gst_number.strip() if payload.gst_number else None,
            work_email=payload.work_email.strip() if payload.work_email else None,
            verification_status="UNVERIFIED",
        )
        db.add(org_prof)
        db.flush()
        org_prof_dict = org_prof.to_dict()

    db.commit()
    db.refresh(new_user)

    user_dict = new_user.to_dict()
    if org_prof_dict:
        user_dict["organizer_profile"] = org_prof_dict

    token = create_session_token(new_user, expires_delta=timedelta(hours=2))
    return {
        "status": "ok",
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict,
        "consent": consent.to_dict(),
        "organizer_profile": org_prof_dict,
    }


@auth_router.post("/logout")
def logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Revoke session on logout by adding token to token blacklist table."""
    if not credentials or not credentials.credentials:
        return {"status": "ok", "message": "Logged out."}

    token = credentials.credentials
    try:
        payload = jwt.decode(token, get_auth_secret(), algorithms=["HS256"])
        exp_timestamp = payload.get("exp", 0)
        expires_at = datetime.fromtimestamp(exp_timestamp) if exp_timestamp else datetime.utcnow() + timedelta(hours=2)
        user_id = payload.get("user_id") or payload.get("sub")
    except Exception:
        expires_at = datetime.utcnow() + timedelta(hours=2)
        user_id = None

    existing = db.query(TokenBlacklistRow).filter(TokenBlacklistRow.token == token).first()
    if not existing:
        revocation = TokenBlacklistRow(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
            revoked_at=datetime.utcnow(),
        )
        db.add(revocation)
        db.commit()

    return {"status": "ok", "message": "Session successfully revoked."}


# -----------------------------------------------------------------------------
# Simulated Phone-OTP Endpoints (Guarded strictly behind DEMO_MODE=true)
# -----------------------------------------------------------------------------

@auth_router.post("/request-otp", dependencies=[Depends(require_demo_mode)])
@limiter.limit("60/minute")
def request_otp(
    request: Request,
    payload: OtpRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate a 6-digit simulated OTP expiring in 5 minutes (Available only in DEMO_MODE)."""
    phone = payload.phone.strip()
    user = find_user_by_phone(db, phone)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No user registered with phone number '{phone}'.",
        )

    code = f"{random.randint(100000, 999999)}"
    code_hash = hash_otp(code, phone)
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    otp_row = db.query(OtpRow).filter(OtpRow.phone == phone).first()
    if otp_row:
        otp_row.code_hash = code_hash
        otp_row.expires_at = expires_at
        otp_row.attempts = 0
    else:
        otp_row = OtpRow(
            phone=phone,
            code_hash=code_hash,
            expires_at=expires_at,
            attempts=0,
        )
        db.add(otp_row)

    db.commit()

    return {
        "status": "ok",
        "message": "OTP generated (simulated).",
        "simulated": True,
        "demo_otp": code,
    }


@auth_router.post("/verify-otp", dependencies=[Depends(require_demo_mode)])
@limiter.limit("60/minute")
def verify_otp(
    request: Request,
    payload: OtpVerifyRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Verify submitted simulated OTP and issue an access token (Available only in DEMO_MODE)."""
    phone = payload.phone.strip()
    otp_submitted = payload.otp.strip()

    otp_row = db.query(OtpRow).filter(OtpRow.phone == phone).first()
    if not otp_row:
        raise HTTPException(
            status_code=401,
            detail="OTP not found or expired. Please request a new OTP.",
        )

    if datetime.utcnow() > otp_row.expires_at:
        db.delete(otp_row)
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="OTP has expired. Please request a new OTP.",
        )

    if otp_row.attempts >= 5:
        raise HTTPException(
            status_code=401,
            detail="Maximum verification attempts exceeded (limit: 5). This OTP is blocked.",
        )

    otp_row.attempts += 1
    db.commit()

    expected_hash = hash_otp(otp_submitted, phone)
    if expected_hash != otp_row.code_hash:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid OTP. Attempt {otp_row.attempts} of 5.",
        )

    user = find_user_by_phone(db, phone)
    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")

    db.delete(otp_row)
    db.commit()

    token = create_session_token(user, expires_delta=timedelta(hours=8))
    return {
        "status": "ok",
        "access_token": token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }


# -----------------------------------------------------------------------------
# Dependency: Current User & Role Verification
# -----------------------------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> UserRow:
    """Extract and validate authenticated user from Bearer JWT with blacklist check."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # 1. Check if token has been revoked in token_blacklist
    is_revoked = db.query(TokenBlacklistRow).filter(TokenBlacklistRow.token == token).first()
    if is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Decode and verify JWT signature and expiration
    try:
        payload = jwt.decode(token, get_auth_secret(), algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing user_id identifier.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(UserRow).filter(UserRow.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user no longer exists in database.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(*roles: str) -> Callable:
    """Role-based access control dependency factory. Preserves existing 403 behavior."""
    def role_checker(current_user: UserRow = Depends(get_current_user)) -> UserRow:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied: Endpoint requires role in {list(roles)}. "
                    f"Current user role: '{current_user.role}'."
                ),
            )
        return current_user

    return role_checker


@auth_router.get("/me")
def get_me(current_user: UserRow = Depends(get_current_user)) -> Dict[str, Any]:
    """Retrieve current authenticated user profile."""
    return current_user.to_dict()
