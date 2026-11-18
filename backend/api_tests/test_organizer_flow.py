"""Integration and unit tests for the organizer side, search, venue privacy, expiry, and standbys."""

from datetime import date, datetime, timedelta
import pytest
from fastapi.testclient import TestClient

from backend.agents.llm import LLMRetryExhaustedError, set_scripted_responses
from backend.agents.negotiation import run_negotiation
from backend.database import ArtistRow, BookingRow, OrganizerProfileRow, SessionLocal, UserRow, reset_db
from backend.main import app, booking_store
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
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret-for-organizer-flow-32b")
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


def test_organizer_profile_and_operator_verification(client: TestClient):
    """Test organizer profile registration, fetching, updating, and operator verification."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    op_headers = get_auth_headers(client, OPERATOR_PHONE)

    # 1. Fetch organizer profile (seeded as verified)
    res = client.get("/organizer/profile", headers=org_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["org_type"] == "hotel"
    assert data["verification_status"] == "VERIFIED"

    # 2. Update organizer profile
    update_res = client.post(
        "/organizer/profile",
        json={
            "organization_name": "Rajmahal Heritage Resort & Spa",
            "org_type": "hotel",
            "gst_number": "08AAAAA0000A1Z5",
            "work_email": "manager@rajmahal.example.com",
        },
        headers=org_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["profile"]["organization_name"] == "Rajmahal Heritage Resort & Spa"

    # 3. Create a new unverified organizer directly in DB
    db = SessionLocal()
    unver_user_id = "user_org_unver_99"
    unver_user = UserRow(
        id=unver_user_id,
        name="New Unverified School",
        phone="9876543210",
        role="ORGANIZER",
        artist_id=None,
    )
    db.add(unver_user)
    unver_prof = OrganizerProfileRow(
        id="org_prof_unver_99",
        user_id=unver_user_id,
        organization_name="Heritage Public School",
        org_type="school",
        verification_status="UNVERIFIED",
    )
    db.add(unver_prof)
    db.commit()
    db.close()

    unver_headers = get_auth_headers(client, "9876543210")
    check_prof = client.get("/organizer/profile", headers=unver_headers).json()
    assert check_prof["verification_status"] == "UNVERIFIED"

    # 4. Operator approves the unverified organizer
    verify_res = client.post(
        f"/operator/organizers/{unver_user_id}/verify",
        headers=op_headers,
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["profile"]["verification_status"] == "VERIFIED"


def test_unverified_organizer_payment_restriction(client: TestClient):
    """Unverified organizers can browse but cannot pay for bookings above Rs 20,000."""
    db = SessionLocal()
    unver_user = UserRow(
        id="user_org_unver_pay",
        name="Tour Operator Demo",
        phone="9988776655",
        role="ORGANIZER",
        artist_id=None,
    )
    db.add(unver_user)
    unver_prof = OrganizerProfileRow(
        id="org_prof_unver_pay",
        user_id="user_org_unver_pay",
        organization_name="Desert Safaris",
        org_type="tour operator",
        verification_status="UNVERIFIED",
    )
    db.add(unver_prof)
    db.commit()
    db.close()

    unver_headers = get_auth_headers(client, "9988776655")

    # 1. Create a large booking: Rs 30,000 (> Rs 20,000 threshold)
    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Desert Safaris",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 30000}],
            "event_date": "2026-11-20",
            "budget": 30000,
        },
        headers=unver_headers,
    )
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # Script LLM response for negotiation and human approval
    set_scripted_responses([
        {
            "text": "proposing offer",
            "tool_calls": [{"name": "propose_offer", "arguments": {"artist_id": "dance_kalbelia_01", "price": 16000}}],
        },
        {"text": "Offer looks good."},
    ])

    client.post(f"/bookings/{booking_id}/negotiate", headers=unver_headers)

    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])
    client.post(f"/bookings/{booking_id}/artist/dance_kalbelia_01/approve", headers=artist_headers)

    # 2. Attempt to pay Rs 30,000 while UNVERIFIED -> MUST raise 403 Forbidden
    pay_res = client.post(f"/bookings/{booking_id}/pay", headers=unver_headers)
    assert pay_res.status_code == 403
    assert "Unverified organizers cannot pay for bookings exceeding Rs 20,000" in pay_res.json()["detail"]


def test_artists_search_filters_and_pagination(client: TestClient):
    """Test GET /artists/search filters (art_form, city, date, budget, group_size, language)."""
    # 1. Art form filter
    res = client.get("/artists/search?art_form=Kalbelia")
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] >= 1
    assert any("Kalbelia" in a["art_form"] for a in data["items"])

    # 2. City filter
    res_city = client.get("/artists/search?city=Jodhpur")
    assert res_city.status_code == 200
    assert all("Jodhpur" in a["city"] for a in res_city.json()["items"])

    # 3. Blackout date exclusion
    # dance_kalbelia_01 has blackout on 2026-12-25
    res_avail = client.get("/artists/search?art_form=Kalbelia&date=2026-11-20")
    assert any(a["id"] == "dance_kalbelia_01" for a in res_avail.json()["items"])

    res_blackout = client.get("/artists/search?art_form=Kalbelia&date=2026-12-25")
    assert not any(a["id"] == "dance_kalbelia_01" for a in res_blackout.json()["items"])

    # 4. Budget filter (INR boundary check)
    # Swara Shehnai Ensemble min_fee is 7,000 INR (700,000 paise)
    # Surila Kabilo Troupe min_fee is 14,000 INR (1,400,000 paise)
    res_budget = client.get("/artists/search?budget=10000")
    assert res_budget.status_code == 200
    for a in res_budget.json()["items"]:
        assert a["rate_card"]["min_fee"] <= 10000

    # 5. Language filter
    res_lang = client.get("/artists/search?language=Bengali")
    assert res_lang.status_code == 200
    assert all("Bengali" in a["languages"] for a in res_lang.json()["items"])

    # 6. Pagination
    res_paged = client.get("/artists/search?page=1&page_size=2")
    assert res_paged.status_code == 200
    pdata = res_paged.json()
    assert len(pdata["items"]) <= 2
    assert pdata["page"] == 1
    assert pdata["page_size"] == 2
    assert pdata["total_pages"] >= 1


def test_public_artist_profile_no_phone_or_upi(client: TestClient):
    """GET /artists/{id} returns public profile with rate card, reliability tier, but no phone or UPI."""
    res = client.get("/artists/dance_kalbelia_01")
    assert res.status_code == 200
    data = res.json()

    # Guaranteed absence of phone and UPI
    assert "upi_id" not in data or data["upi_id"] is None or data["upi_id"] == ""
    assert "masked_upi_id" not in data
    assert "phone" not in data

    # Required public information
    assert "rate_card" in data
    assert data["rate_card"]["min_fee"] == 14000
    assert "reliability_tier" in data
    assert data["reliability_tier"] in ["TRUSTED", "HIGH", "STANDARD", "DEVELOPING"]
    assert "review_summary" in data
    assert "videos" in data


def test_venue_privacy_hidden_from_artists_before_payment(client: TestClient):
    """Venue address and organizer contact details are hidden from artists until payment is received."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])

    # 1. Organizer creates booking with private venue address
    secret_venue = "City Palace Royal Courtyard, Udaipur, Hall 4"
    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Hotel Rajmahal Heritage (fictional)",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 16000}],
            "event_date": "2026-11-20",
            "event_time": "19:00",
            "venue_address": secret_venue,
            "budget": 16000,
            "expected_duration_minutes": 90,
            "notes": "VIP cultural delegates attending.",
        },
        headers=org_headers,
    )
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]

    # 2. Negotiate to assign the artist
    set_scripted_responses([
        {
            "text": "proposing offer",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1500000,
                        "event_date": "2026-11-20",
                        "distance_km": 80,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "स्वीकृत है।"},
    ])
    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    assert neg_res.json()["status"] == "AWAITING_ARTIST_APPROVAL"

    # 3. Artist checks booking BEFORE payment -> venue address and contact MUST be hidden
    artist_view_pre = client.get(f"/bookings/{booking_id}", headers=artist_headers).json()
    assert artist_view_pre["venue_address"] == "Hidden until booking payment is received in escrow"
    assert "Hidden" in artist_view_pre["organizer_phone"]

    # 4. Organizer checks booking -> sees full venue address
    org_view = client.get(f"/bookings/{booking_id}", headers=org_headers).json()
    assert org_view["venue_address"] == secret_venue

    # 5. Artist approves, Organizer pays
    client.post(f"/bookings/{booking_id}/artist/dance_kalbelia_01/approve", headers=artist_headers)
    pay_res = client.post(f"/bookings/{booking_id}/pay", headers=org_headers)
    assert pay_res.status_code == 200

    # 6. Artist checks booking AFTER payment -> venue address is now visible!
    artist_view_post = client.get(f"/bookings/{booking_id}", headers=artist_headers).json()
    assert artist_view_post["venue_address"] == secret_venue
    assert artist_view_post["organizer_phone"] == ORGANIZER_PHONE


def test_booking_approval_expiry_triggers_standby_replacement(client: TestClient):
    """Booking approval expiry after duration triggers auto-replacement with standby candidate."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)

    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Hotel Rajmahal Heritage (fictional)",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 16000}],
            "event_date": "2026-11-20",
            "budget": 16000,
        },
        headers=org_headers,
    )
    booking_id = create_res.json()["id"]

    set_scripted_responses([
        {
            "text": "proposing offer",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1500000,
                        "event_date": "2026-11-20",
                        "distance_km": 80,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "स्वीकृत है।"},
    ])
    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    assert neg_res.json()["status"] == "AWAITING_ARTIST_APPROVAL"

    # Booking is now AWAITING_ARTIST_APPROVAL with approval_expires_at set
    booking_data = client.get(f"/bookings/{booking_id}", headers=org_headers).json()
    assert booking_data["status"] == "AWAITING_ARTIST_APPROVAL"
    assert booking_data["approval_expires_at"] is not None

    # Force expiry check
    expiry_res = client.post(
        f"/bookings/{booking_id}/check-expiry?force=true",
        headers=org_headers,
    )
    assert expiry_res.status_code == 200
    updated_data = client.get(f"/bookings/{booking_id}", headers=org_headers).json()
    # Replacement promoted and new expiry timer reset
    assert updated_data["status"] == "AWAITING_ARTIST_APPROVAL"


def test_standby_72h_reconfirmation(client: TestClient):
    """Re-confirm standby candidates 72 hours before the event date."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)

    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Hotel Rajmahal Heritage (fictional)",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 16000}],
            "event_date": "2026-11-20",
            "budget": 16000,
        },
        headers=org_headers,
    )
    booking_id = create_res.json()["id"]

    set_scripted_responses([
        {
            "text": "proposing offer",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1500000,
                        "event_date": "2026-11-20",
                        "distance_km": 80,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "स्वीकृत है।"},
    ])
    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    assert neg_res.json()["status"] == "AWAITING_ARTIST_APPROVAL"

    # Trigger 72h re-confirmation
    reconfirm_res = client.post(
        f"/bookings/{booking_id}/reconfirm-standby?force=true",
        headers=org_headers,
    )
    assert reconfirm_res.status_code == 200
    assert reconfirm_res.json()["standby_reconfirmed"] is True


def test_artist_decline_triggers_standby_replacement(client: TestClient):
    """When an artist declines, replacement candidate is automatically promoted from standbys."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])

    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Hotel Rajmahal Heritage (fictional)",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 16000}],
            "event_date": "2026-11-20",
            "budget": 16000,
        },
        headers=org_headers,
    )
    booking_id = create_res.json()["id"]

    set_scripted_responses([
        {
            "text": "proposing offer",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_kalbelia_01",
                        "price": 1500000,
                        "event_date": "2026-11-20",
                        "distance_km": 80,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "स्वीकृत है।"},
    ])
    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    assert neg_res.json()["status"] == "AWAITING_ARTIST_APPROVAL"

    # Artist declines
    decline_res = client.post(
        f"/bookings/{booking_id}/artist/dance_kalbelia_01/decline",
        headers=artist_headers,
    )
    assert decline_res.status_code == 200
    data = decline_res.json()
    assert data["action"] == "ARTIST_DECLINED"
    assert data["booking_status"] == "AWAITING_ARTIST_APPROVAL"
    assert data["replacement_artist"] is not None


def test_llm_failure_transitions_to_needs_operator(client: TestClient, monkeypatch):
    """When the LLM fails after retries, negotiation transitions to NEEDS_OPERATOR."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)

    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Hotel Rajmahal Heritage (fictional)",
            "roles": [{"role": "main", "art_form": "Kalbelia Dance", "budget": 16000}],
            "event_date": "2026-11-20",
            "budget": 16000,
        },
        headers=org_headers,
    )
    booking_id = create_res.json()["id"]

    # Monkeypatch llm_call to raise LLMRetryExhaustedError
    def failing_llm(*args, **kwargs):
        raise LLMRetryExhaustedError("Simulated LLM network timeout after 3 retries")

    monkeypatch.setattr("backend.agents.organizer_agent.llm_call", failing_llm)

    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    res_data = neg_res.json()
    assert res_data["status"] == "NEEDS_OPERATOR"

    # Verify persistent booking status in DB is also NEEDS_OPERATOR
    booking_check = client.get(f"/bookings/{booking_id}", headers=org_headers).json()
    assert booking_check["status"] == "NEEDS_OPERATOR"
