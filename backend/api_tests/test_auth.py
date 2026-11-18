"""Tests for simulated phone-OTP authentication and role-based access control (RBAC)."""

from datetime import datetime, timedelta
import pytest
from fastapi.testclient import TestClient

from backend.database import OtpRow, SessionLocal, UserRow, reset_db
from backend.main import app
from backend.seed import (
    ARTIST_PHONES,
    OPERATOR_PHONE,
    ORGANIZER_PHONE,
    seed_database,
)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "scripted")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret-for-unit-testing-32b")
    reset_db()
    db = SessionLocal()
    seed_database(db=db)
    db.close()
    return TestClient(app)


def get_auth_headers(client: TestClient, phone: str) -> dict:
    """Helper requesting OTP and verifying to return Authorization Bearer header."""
    req_res = client.post("/auth/request-otp", json={"phone": phone})
    assert req_res.status_code == 200, f"Request OTP failed: {req_res.text}"
    demo_otp = req_res.json()["demo_otp"]

    ver_res = client.post("/auth/verify-otp", json={"phone": phone, "otp": demo_otp})
    assert ver_res.status_code == 200, f"Verify OTP failed: {ver_res.text}"
    token = ver_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_wrong_otp_returns_401(client: TestClient):
    """Wrong OTP returns 401 status."""
    # 1. Request OTP
    req_res = client.post("/auth/request-otp", json={"phone": ORGANIZER_PHONE})
    assert req_res.status_code == 200

    # 2. Submit wrong OTP
    ver_res = client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": "000000"})
    assert ver_res.status_code == 401
    assert "Invalid OTP" in ver_res.json()["detail"]


def test_expired_otp_returns_401(client: TestClient):
    """Expired OTP returns 401 status."""
    # 1. Request OTP
    req_res = client.post("/auth/request-otp", json={"phone": ORGANIZER_PHONE})
    assert req_res.status_code == 200
    valid_otp = req_res.json()["demo_otp"]

    # 2. Artificially expire the OTP record in the database
    db = SessionLocal()
    otp_record = db.query(OtpRow).filter(OtpRow.phone == ORGANIZER_PHONE).first()
    assert otp_record is not None
    otp_record.expires_at = datetime.utcnow() - timedelta(minutes=10)
    db.commit()
    db.close()

    # 3. Attempt verification with expired OTP
    ver_res = client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": valid_otp})
    assert ver_res.status_code == 401
    assert "expired" in ver_res.json()["detail"].lower()


def test_sixth_attempt_is_blocked(client: TestClient):
    """6th verification attempt is blocked with 401."""
    # 1. Request OTP
    req_res = client.post("/auth/request-otp", json={"phone": ORGANIZER_PHONE})
    assert req_res.status_code == 200
    correct_otp = req_res.json()["demo_otp"]

    # 2. Fail 5 times
    for attempt in range(1, 6):
        res = client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": "111111"})
        assert res.status_code == 401

    # 3. 6th attempt (even with correct OTP) must be blocked
    sixth_res = client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": correct_otp})
    assert sixth_res.status_code == 401
    assert "exceeded" in sixth_res.json()["detail"].lower() or "blocked" in sixth_res.json()["detail"].lower()


def test_no_token_returns_401(client: TestClient):
    """Endpoints requiring authentication return 401 when no token is supplied."""
    # 1. Bookings creation
    res1 = client.post("/bookings", json={"organizer_name": "Test", "roles": [], "event_date": "2026-12-20", "budget": 10000})
    assert res1.status_code == 401

    # 2. Get booking
    res2 = client.get("/bookings/book_123")
    assert res2.status_code == 401

    # 3. Get audit log
    res3 = client.get("/bookings/book_123/audit")
    assert res3.status_code == 401

    # 4. Get trustpay
    res4 = client.get("/bookings/book_123/trustpay")
    assert res4.status_code == 401

    # 5. Auth me
    res5 = client.get("/auth/me")
    assert res5.status_code == 401


def test_artist_a_cannot_approve_artist_b_offer(client: TestClient):
    """Artist A cannot approve Artist B's offer (returns 403)."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    artist_a_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])
    artist_b_headers = get_auth_headers(client, ARTIST_PHONES["music_sarangi_03"])

    # 1. Create booking by organizer
    create_res = client.post(
        "/bookings",
        headers=org_headers,
        json={
            "organizer_name": "Royal Fest",
            "roles": [{"art_form": "Kalbelia Dance", "budget": 14000}],
            "event_date": "2026-12-20",
            "budget": 20000,
        },
    )
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # Fast-track booking status to AWAITING_ARTIST_APPROVAL in DB
    from backend.database import BookingRow
    db = SessionLocal()
    b = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    b.status = "AWAITING_ARTIST_APPROVAL"
    db.commit()
    db.close()

    # 2. Artist B attempts to approve for Artist A (dance_kalbelia_01)
    appr_res = client.post(
        f"/bookings/{booking_id}/artist/dance_kalbelia_01/approve",
        headers=artist_b_headers,
    )
    assert appr_res.status_code == 403
    assert "Forbidden" in appr_res.json()["detail"]


def test_organizer_cannot_approve_on_behalf_of_artist(client: TestClient):
    """Organizer cannot approve on behalf of an artist (returns 403)."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)

    # 1. Create booking by organizer
    create_res = client.post(
        "/bookings",
        headers=org_headers,
        json={
            "organizer_name": "Royal Fest",
            "roles": [{"art_form": "Kalbelia Dance", "budget": 14000}],
            "event_date": "2026-12-20",
            "budget": 20000,
        },
    )
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # 2. Organizer attempts to call artist approve endpoint
    appr_res = client.post(
        f"/bookings/{booking_id}/artist/dance_kalbelia_01/approve",
        headers=org_headers,
    )
    assert appr_res.status_code == 403
    assert "Access denied" in appr_res.json()["detail"] or "Forbidden" in appr_res.json()["detail"]


def test_artist_cannot_call_payout_or_demo_endpoints(client: TestClient):
    """Artist cannot call payout or demo endpoints (returns 403)."""
    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])

    # 1. Payout
    payout_res = client.post("/bookings/book_test/payout", headers=artist_headers)
    assert payout_res.status_code == 403

    # 2. Advance time
    adv_res = client.post("/demo/advance-time", headers=artist_headers)
    assert adv_res.status_code == 403

    # 3. Fail next payout
    fail_res = client.post("/demo/fail-next-payout", headers=artist_headers)
    assert fail_res.status_code == 403


def test_user_not_in_booking_cannot_read_audit_log(client: TestClient):
    """A user not involved in the booking cannot read its audit log or details (returns 403)."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    unrelated_artist_headers = get_auth_headers(client, ARTIST_PHONES["craft_bluepottery_01"])

    # 1. Create booking by organizer
    create_res = client.post(
        "/bookings",
        headers=org_headers,
        json={
            "organizer_name": "Private Heritage Gala",
            "roles": [{"art_form": "Kalbelia Dance", "budget": 14000}],
            "event_date": "2026-12-20",
            "budget": 20000,
        },
    )
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # 2. Unrelated artist attempts to read audit log
    audit_res = client.get(f"/bookings/{booking_id}/audit", headers=unrelated_artist_headers)
    assert audit_res.status_code == 403
    assert "Forbidden" in audit_res.json()["detail"]

    # 3. Unrelated artist attempts to read booking info
    get_res = client.get(f"/bookings/{booking_id}", headers=unrelated_artist_headers)
    assert get_res.status_code == 403


# -----------------------------------------------------------------------------
# Firebase Identity, Session & Registration Tests (Mocked verify_identity)
# -----------------------------------------------------------------------------

def test_session_existing_user(client: TestClient, monkeypatch):
    """POST /auth/session with a valid Firebase ID token for an existing user returns 200 and a JWT."""
    import backend.auth as auth_mod
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: f"+91{ORGANIZER_PHONE}")

    res = client.post("/auth/session", json={"id_token": "valid_firebase_test_token"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "ORGANIZER"
    assert data["user"]["phone"] == ORGANIZER_PHONE


def test_session_unregistered_phone_returns_404(client: TestClient, monkeypatch):
    """POST /auth/session for an unregistered phone returns 404 with detail 'Not registered'."""
    import backend.auth as auth_mod
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: "+919876543219")

    res = client.post("/auth/session", json={"id_token": "valid_firebase_test_token_new_user"})
    assert res.status_code == 404
    assert res.json()["detail"] == "Not registered"


def test_session_invalid_firebase_token_returns_401(client: TestClient, monkeypatch):
    """POST /auth/session with an invalid Firebase ID token returns 401."""
    import backend.auth as auth_mod
    from fastapi import HTTPException
    def mock_invalid(token):
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase ID token")
    monkeypatch.setattr(auth_mod, "verify_identity", mock_invalid)

    res = client.post("/auth/session", json={"id_token": "bad_token"})
    assert res.status_code == 401
    assert "Invalid or expired Firebase ID token" in res.json()["detail"]


def test_register_organizer_records_consent(client: TestClient, monkeypatch):
    """POST /auth/register creates user and records legal consent for an ORGANIZER."""
    import backend.auth as auth_mod
    from backend.database import ConsentRow
    test_phone = "+919811122233"
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: test_phone)

    payload = {
        "id_token": "valid_firebase_token",
        "name": "Maharaja Palace Events",
        "role": "ORGANIZER",
        "language": "hi",
        "terms_version": "1.0",
        "privacy_version": "1.0",
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["name"] == "Maharaja Palace Events"
    assert data["user"]["role"] == "ORGANIZER"
    assert data["consent"]["terms_version"] == "1.0"
    assert data["consent"]["privacy_version"] == "1.0"

    # Verify DB persistence
    db = SessionLocal()
    consent = db.query(ConsentRow).filter(ConsentRow.user_id == data["user"]["id"]).first()
    assert consent is not None
    assert consent.terms_version == "1.0"
    db.close()


def test_register_operator_is_strictly_forbidden(client: TestClient, monkeypatch):
    """POST /auth/register rejects OPERATOR registration attempts with 400 Bad Request."""
    import backend.auth as auth_mod
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: "+919999999999")

    payload = {
        "id_token": "valid_firebase_token",
        "name": "Rogue Operator",
        "role": "OPERATOR",
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400
    assert "OPERATOR accounts can never self-register" in res.json()["detail"]


def test_register_already_existing_phone_returns_400(client: TestClient, monkeypatch):
    """POST /auth/register rejects registration if user with phone already exists."""
    import backend.auth as auth_mod
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: f"+91{ORGANIZER_PHONE}")

    payload = {
        "id_token": "valid_firebase_token",
        "name": "Duplicate Organizer",
        "role": "ORGANIZER",
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"]


def test_logout_revokes_session(client: TestClient, monkeypatch):
    """POST /auth/logout blacklists the token; subsequent calls with this token return 401."""
    import backend.auth as auth_mod
    monkeypatch.setattr(auth_mod, "verify_identity", lambda token: f"+91{ORGANIZER_PHONE}")

    # 1. Obtain a valid session token
    sess_res = client.post("/auth/session", json={"id_token": "valid_firebase_token"})
    assert sess_res.status_code == 200
    token = sess_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Token works for /auth/me
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200

    # 3. Call logout
    logout_res = client.post("/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert "revoked" in logout_res.json()["message"].lower()

    # 4. Token is now revoked; calling /auth/me must return 401
    me_after = client.get("/auth/me", headers=headers)
    assert me_after.status_code == 401
    assert "revoked" in me_after.json()["detail"].lower()


def test_simulated_otp_disabled_when_demo_mode_false(client: TestClient, monkeypatch):
    """Simulated OTP routes return 404 when DEMO_MODE is false."""
    monkeypatch.setenv("DEMO_MODE", "false")
    req_res = client.post("/auth/request-otp", json={"phone": ORGANIZER_PHONE})
    assert req_res.status_code == 404
    ver_res = client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": "123456"})
    assert ver_res.status_code == 404
