"""Integration test for the Dec 20 one-click demo scenario with authentication."""

from fastapi.testclient import TestClient
import pytest

from backend.database import BookingRow, SessionLocal
from backend.main import app
from backend.seed import OPERATOR_PHONE


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "scripted")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret-for-demo-scenario-32b")
    from backend.database import reset_db
    from backend.seed import seed_database
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


def test_one_click_demo_scenario_audit_order(client: TestClient):
    """Run one-click demo scenario and assert chronological sequence of audit events."""
    op_headers = get_auth_headers(client, OPERATOR_PHONE)

    # 1. Execute demo scenario endpoint (OPERATOR only)
    response = client.post("/demo/run-scenario", headers=op_headers)
    assert response.status_code == 200
    data = response.json()
    booking_id = data["booking_id"]

    # 2. Assert booking is in AWAITING_ARTIST_APPROVAL and NOT APPROVED
    assert data["booking_status"] == "AWAITING_ARTIST_APPROVAL"
    assert data["booking_status"] != "APPROVED"

    # Verify DB persistence directly
    db = SessionLocal()
    booking = db.query(BookingRow).filter(BookingRow.id == booking_id).first()
    assert booking is not None
    assert booking.status == "AWAITING_ARTIST_APPROVAL"
    assert booking.status != "APPROVED"
    assert booking.organizer_name == "Hotel Rajmahal Heritage (fictional)"
    assert booking.budget == 25000 * 100
    db.close()

    # 3. Retrieve audit log
    audit_res = client.get(f"/bookings/{booking_id}/audit", headers=op_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()

    # Find indices of key events
    idx_puppet_standby = -1
    idx_higher_musician_standby = -1
    idx_below_min_rejected = -1
    idx_corrected_proposed = -1

    for idx, entry in enumerate(logs):
        action = entry["action"]
        details = entry.get("details", {})

        # Standby 1: Puppeteer (needs approval)
        if (
            action == "STANDBY_CHECKED"
            and details.get("candidate_artist_id") == "puppet_kathputli_01"
            and details.get("needs_organizer_approval") is True
        ):
            idx_puppet_standby = idx

        # Standby 2: Musician Rs 2,000 above budget (needs approval)
        elif (
            action == "STANDBY_CHECKED"
            and details.get("candidate_artist_id") == "music_pandavani_02"
            and details.get("needs_organizer_approval") is True
        ):
            idx_higher_musician_standby = idx

        # Below-minimum offer rejected (5,500 < 7,000)
        elif (
            action == "OFFER_REJECTED"
            and details.get("artist_id") == "music_sarangi_03"
            and details.get("price") in [5500, 550000, 5500 * 100]
        ):
            idx_below_min_rejected = idx

        # Corrected offer proposed (7,000 >= 7,000)
        elif (
            action == "OFFER_PROPOSED"
            and details.get("artist_id") == "music_sarangi_03"
            and details.get("price") in [7000, 700000, 7000 * 100]
        ):
            idx_corrected_proposed = idx

    # Assert that all 4 events occurred
    assert idx_puppet_standby != -1, "Missing STANDBY_CHECKED for puppeteer"
    assert (
        idx_higher_musician_standby != -1
    ), "Missing STANDBY_CHECKED for Rs 2,000-higher musician"
    assert (
        idx_below_min_rejected != -1
    ), "Missing OFFER_REJECTED for below-minimum offer"
    assert (
        idx_corrected_proposed != -1
    ), "Missing OFFER_PROPOSED for corrected offer"

    # Assert exact chronological order
    assert (
        idx_puppet_standby
        < idx_higher_musician_standby
        < idx_below_min_rejected
        < idx_corrected_proposed
    ), (
        f"Events not in expected sequence: "
        f"Puppet ({idx_puppet_standby}) < Higher Musician ({idx_higher_musician_standby}) < "
        f"Below Min Rejection ({idx_below_min_rejected}) < Corrected Offer ({idx_corrected_proposed})"
    )
