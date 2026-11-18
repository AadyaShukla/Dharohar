"""API integration tests covering full happy path and failure injection flows with authentication."""

from datetime import date
import pytest
from fastapi.testclient import TestClient

from backend.agents.llm import set_scripted_responses
from backend.database import SessionLocal, reset_db
from backend.main import app, mock_provider
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
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret-for-api-flow-32b")
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


def test_full_happy_path(client: TestClient):
    """Test full booking lifecycle from creation through negotiation, approval, escrow, payout, and closure."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_kalbelia_01"])
    op_headers = get_auth_headers(client, OPERATOR_PHONE)

    # 1. Create booking (ORGANIZER)
    create_payload = {
        "organizer_name": "Hotel Rajmahal Heritage (fictional)",
        "roles": [
            {
                "role": "lead_dance",
                "art_form": "Kalbelia Dance",
                "budget": 16000,
            }
        ],
        "event_date": "2026-11-20",
        "budget": 20000,
        "distance_km": 80,
        "duration_minutes": 60,
        "group_size": 6,
    }
    create_res = client.post("/bookings", json=create_payload, headers=org_headers)
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]
    assert create_res.json()["status"] == "REQUESTED"

    # 2. Negotiate booking (ORGANIZER)
    scripted = [
        # Organizer proposes
        {
            "text": "Proposing Kalbelia dancers.",
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
        # Artist agent approves
        {"text": "स्वीकृत है।"},
    ]
    set_scripted_responses(scripted)

    neg_res = client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    assert neg_res.status_code == 200
    assert neg_res.json()["status"] == "AWAITING_ARTIST_APPROVAL"

    # 3. Human Artist Approval -> transitions booking to APPROVED (ARTIST)
    appr_res = client.post(
        f"/bookings/{booking_id}/artist/dance_kalbelia_01/approve",
        headers=artist_headers,
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["booking_status"] == "APPROVED"

    # 4. Organizer Escrow Payment -> transitions booking to PAID (ORGANIZER)
    pay_res = client.post(f"/bookings/{booking_id}/pay", headers=org_headers)
    assert pay_res.status_code == 200
    assert pay_res.json()["booking_status"] == "PAID"

    # 5. Release Payout -> initiates PENDING payout (OPERATOR)
    payout_res = client.post(f"/bookings/{booking_id}/payout", headers=op_headers)
    assert payout_res.status_code == 200
    assert payout_res.json()["status"] == "PENDING"

    # 6. Advance Time -> settles payout in mock provider (OPERATOR)
    adv_res = client.post(f"/demo/advance-time?booking_id={booking_id}", headers=op_headers)
    assert adv_res.status_code == 200

    # Booking must NOT be CLOSED yet (waiting for acknowledgment)
    b_res = client.get(f"/bookings/{booking_id}", headers=org_headers)
    assert b_res.json()["status"] == "PAID"

    # 7. Artist Acknowledges Receipt -> transitions booking to CLOSED (ARTIST)
    ack_res = client.post(
        f"/bookings/{booking_id}/artist-acknowledge",
        json={"confirmed": True},
        headers=artist_headers,
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["booking_status"] == "CLOSED"
    assert ack_res.json()["artist_ack_status"] == "CONFIRMED"

    # 8. Verify TrustPay final status
    tp_res = client.get(f"/bookings/{booking_id}/trustpay", headers=org_headers)
    assert tp_res.status_code == 200
    data = tp_res.json()
    assert data["organizer_payment_status"] == "RECEIVED"
    assert data["artist_payout_status"] == "SUCCESSFUL"
    assert data["artist_ack_status"] == "CONFIRMED"
    assert data["booking_status"] == "CLOSED"

    # 9. Verify Audit Log
    audit_res = client.get(f"/bookings/{booking_id}/audit", headers=org_headers)
    assert audit_res.status_code == 200
    events = [e["action"] for e in audit_res.json()]
    assert "OFFER_PROPOSED" in events
    assert "ARTIST_APPROVED" in events


def test_failed_payout_and_reconciliation_flow(client: TestClient):
    """Test failure injection triggering reconciliation ticket and retry."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    artist_headers = get_auth_headers(client, ARTIST_PHONES["dance_ghoomar_02"])
    op_headers = get_auth_headers(client, OPERATOR_PHONE)

    # 1. Create and fast-track to approved
    create_payload = {
        "organizer_name": "Hotel Rajmahal Heritage (fictional)",
        "roles": [{"art_form": "Ghoomar Dance", "budget": 14000}],
        "event_date": "2026-11-20",
        "budget": 16000,
    }
    create_res = client.post("/bookings", json=create_payload, headers=org_headers)
    booking_id = create_res.json()["id"]

    scripted = [
        {
            "text": "Propose ghoomar.",
            "tool_calls": [
                {
                    "name": "propose_offer",
                    "arguments": {
                        "booking_id": booking_id,
                        "artist_id": "dance_ghoomar_02",
                        "price": 1300000,
                        "event_date": "2026-11-20",
                        "distance_km": 100,
                        "duration_minutes": 60,
                        "group_size": 6,
                    },
                }
            ],
        },
        {"text": "Accept."},
    ]
    set_scripted_responses(scripted)

    client.post(f"/bookings/{booking_id}/negotiate", headers=org_headers)
    client.post(
        f"/bookings/{booking_id}/artist/dance_ghoomar_02/approve",
        headers=artist_headers,
    )
    client.post(f"/bookings/{booking_id}/pay", headers=org_headers)

    # 2. Inject failure (OPERATOR)
    fail_res = client.post("/demo/fail-next-payout", headers=op_headers)
    assert fail_res.status_code == 200

    # 3. Release Payout -> fails immediately (OPERATOR)
    payout_res = client.post(f"/bookings/{booking_id}/payout", headers=op_headers)
    assert payout_res.status_code == 200
    assert payout_res.json()["status"] == "FAILED"

    # 4. Advance time sync -> triggers ticket creation and retry (OPERATOR)
    client.post(f"/demo/advance-time?booking_id={booking_id}", headers=op_headers)

    # 5. Check TrustPay and Reconciliation Tickets
    tp_res = client.get(f"/bookings/{booking_id}/trustpay", headers=org_headers)
    assert tp_res.status_code == 200
    tp_data = tp_res.json()
    assert len(tp_data["tickets"]) >= 1
    assert tp_data["tickets"][0]["status"] == "RESOLVED"


def test_illegal_transition_errors(client: TestClient):
    """Confirm illegal status transitions return 4xx client errors."""
    org_headers = get_auth_headers(client, ORGANIZER_PHONE)
    op_headers = get_auth_headers(client, OPERATOR_PHONE)

    # 1. Non-existent booking
    res = client.get("/bookings/non_existent_id", headers=org_headers)
    assert res.status_code == 404

    # 2. Payment before artist approval
    create_res = client.post(
        "/bookings",
        json={
            "organizer_name": "Premature Payment",
            "roles": [{"art_form": "Kalbelia Dance"}],
            "event_date": "2026-11-20",
            "budget": 10000,
        },
        headers=org_headers,
    )
    b_id = create_res.json()["id"]

    pay_res = client.post(f"/bookings/{b_id}/pay", headers=org_headers)
    assert pay_res.status_code == 400
    assert "Artist approval has not been recorded" in pay_res.json()["detail"]

    # 3. Payout before payment
    payout_res = client.post(f"/bookings/{b_id}/payout", headers=op_headers)
    assert payout_res.status_code == 400
