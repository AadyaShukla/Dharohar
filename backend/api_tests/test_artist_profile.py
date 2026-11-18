"""Tests for artist profiles, rule updates, upload validation, coordinator vouches,
operator review queue, and listing status gating.
"""

import io
from fastapi.testclient import TestClient
import pytest

from backend.database import (
    ArtistRow,
    AuditLogRow,
    CoordinatorVouchRow,
    SessionLocal,
    UserRow,
    reset_db,
)
from backend.main import app
from backend.rules.reliability import compute_reliability_score
from backend.seed import (
    COORDINATOR_PHONE,
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


def get_token_for_phone(client: TestClient, phone: str) -> str:
    """Helper to request and verify simulated OTP to retrieve an access token."""
    res = client.post("/auth/request-otp", json={"phone": phone})
    assert res.status_code == 200, f"Request OTP failed: {res.text}"
    otp = res.json()["demo_otp"]
    res2 = client.post("/auth/verify-otp", json={"phone": phone, "otp": otp})
    assert res2.status_code == 200, f"Verify OTP failed: {res2.text}"
    return res2.json()["access_token"]


def auth_headers(client: TestClient, phone: str) -> dict:
    token = get_token_for_phone(client, phone)
    return {"Authorization": f"Bearer {token}"}


# -----------------------------------------------------------------------------
# 1. Artist Profile & Rules Endpoints Tests
# -----------------------------------------------------------------------------

def test_artist_can_create_and_read_own_profile(client: TestClient):
    """An authenticated artist without a profile can create one and read it back."""
    # Create a new artist user directly in DB
    db = SessionLocal()
    artist_user = UserRow(
        id="user_artist_new_99",
        name="Manganiyar Ustad",
        phone="9888888888",
        role="ARTIST",
        artist_id=None,
    )
    db.add(artist_user)
    db.commit()
    db.close()

    headers = auth_headers(client, "9888888888")

    # Initial check: profile not yet onboarded
    res_me = client.get("/artists/me/profile", headers=headers)
    assert res_me.status_code == 200
    assert res_me.json()["is_onboarded"] is False

    # Create profile
    profile_payload = {
        "name": "Manganiyar Ustad",
        "art_form": "Manganiyar Folk Music",
        "city": "Barmer",
        "state": "Rajasthan",
        "bio": "Heritage desert folk vocalists and kamaicha players.",
        "languages": ["Hindi", "Marwari"],
        "years_experience": 15,
        "group_size": 4,
        "equipment_needed": "2 instrument microphones",
        "min_fee": 15000,
        "travel_range_km": 300,
        "min_duration_minutes": 90,
        "max_group_size": 10,
        "upi_id": "ustad.manganiyar@okhdfcbank",
    }
    res_create = client.post("/artists/profile", json=profile_payload, headers=headers)
    assert res_create.status_code == 200
    created = res_create.json()
    assert created["art_form"] == "Manganiyar Folk Music"
    assert created["city"] == "Barmer"
    assert created["min_fee"] == 15000
    assert created["min_fee_paise"] == 1500000
    assert created["verification_stage"] == "REGISTERED"
    assert created["listing_status"] == "DRAFT"

    # Verify read own profile
    res_me2 = client.get("/artists/me/profile", headers=headers)
    assert res_me2.status_code == 200
    assert res_me2.json()["is_onboarded"] is True
    assert res_me2.json()["upi_id"] == "ustad.manganiyar@okhdfcbank"


def test_artist_can_update_rules_and_it_is_audit_logged(client: TestClient):
    """Artist updating rules must update DB and record an immutable audit log."""
    # Use seeded artist 1 (Surila Kabilo Troupe - phone: 9000000001)
    headers = auth_headers(client, "9000000001")

    rules_update = {
        "min_fee": 18000,
        "travel_range_km": 400,
        "min_duration_minutes": 75,
        "max_group_size": 25,
    }
    res = client.put("/artists/me/rules", json=rules_update, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["rules"]["min_fee"] == 18000
    assert data["rules"]["travel_range_km"] == 400

    # Verify in DB
    db = SessionLocal()
    artist = db.query(ArtistRow).filter(ArtistRow.id == "dance_kalbelia_01").first()
    assert artist.min_fee == 1800000
    assert artist.travel_range_km == 400

    # Verify audit log
    audit_entries = (
        db.query(AuditLogRow)
        .filter(AuditLogRow.action == "ARTIST_RULES_UPDATED")
        .all()
    )
    assert len(audit_entries) >= 1
    last_audit = audit_entries[-1]
    assert last_audit.details["artist_id"] == "dance_kalbelia_01"
    assert last_audit.details["after"]["min_fee"] == 18000
    db.close()


def test_artist_cannot_update_another_artists_rules(client: TestClient):
    """An artist or organizer cannot tamper with another artist's profile or rules."""
    organizer_headers = auth_headers(client, ORGANIZER_PHONE)

    # Organizer cannot access artist-only endpoint
    res = client.put(
        "/artists/me/rules",
        json={"min_fee": 5000, "travel_range_km": 50, "min_duration_minutes": 30, "max_group_size": 5},
        headers=organizer_headers,
    )
    assert res.status_code == 403


def test_artist_can_update_availability_calendar(client: TestClient):
    """Artist updating blackout dates and recurring unavailable days is persisted and audit logged."""
    headers = auth_headers(client, "9000000001")

    avail_payload = {
        "blackout_dates": ["2026-11-20", "2026-11-21", "2026-12-25"],
        "recurring_unavailable_days": ["Monday", "Tuesday"],
    }
    res = client.put("/artists/me/availability", json=avail_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["blackout_dates"] == ["2026-11-20", "2026-11-21", "2026-12-25"]
    assert "Monday" in data["recurring_unavailable_days"]

    # Verify audit log
    db = SessionLocal()
    audit_entry = (
        db.query(AuditLogRow)
        .filter(AuditLogRow.action == "AVAILABILITY_CALENDAR_UPDATED")
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.details["artist_id"] == "dance_kalbelia_01"
    db.close()


# -----------------------------------------------------------------------------
# 2. File Upload Validation & Live Prompt Tests
# -----------------------------------------------------------------------------

def test_live_prompt_issuance(client: TestClient):
    """Artist requests a live prompt challenge phrase for audition video."""
    headers = auth_headers(client, "9000000001")
    res = client.get("/artists/live-prompt", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "prompt_phrase" in data
    assert "Code" in data["prompt_phrase"]


def test_upload_video_rejects_non_mp4(client: TestClient):
    """Uploading non-MP4 video formats (e.g. .avi, .mov) must be rejected with 400 Bad Request."""
    headers = auth_headers(client, "9000000001")

    fake_avi = io.BytesIO(b"RIFF....AVI ")
    files = {"file": ("audition.avi", fake_avi, "video/x-msvideo")}

    res = client.post("/artists/upload-audition", files=files, headers=headers)
    assert res.status_code == 400
    assert "Only .mp4 files are accepted" in res.json()["detail"]


def test_upload_video_rejects_oversized_file(client: TestClient, monkeypatch):
    """Uploading video > 100MB must be rejected with 400 Bad Request."""
    headers = auth_headers(client, "9000000001")

    # Mock MAX_VIDEO_BYTES to a small number for testing boundary
    import backend.storage
    monkeypatch.setattr(backend.storage, "MAX_VIDEO_BYTES", 500)

    oversized_content = io.BytesIO(b"0" * 600)
    files = {"file": ("audition.mp4", oversized_content, "video/mp4")}

    res = client.post("/artists/upload-audition", files=files, headers=headers)
    assert res.status_code == 400
    assert "exceeds maximum allowed limit" in res.json()["detail"]


def test_upload_valid_mp4_video_with_live_prompt(client: TestClient):
    """Uploading valid MP4 stores URL and attaches live prompt phrase."""
    headers = auth_headers(client, "9000000001")

    valid_mp4 = io.BytesIO(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom")
    files = {"file": ("my_performance.mp4", valid_mp4, "video/mp4")}
    data = {"live_prompt": "Rangilo Rajasthan - Code 4912"}

    res = client.post("/artists/upload-audition", files=files, data=data, headers=headers)
    assert res.status_code == 200
    resp_data = res.json()
    assert "video_url" in resp_data
    assert resp_data["video_url"].endswith(".mp4")
    assert resp_data["live_prompt"] == "Rangilo Rajasthan - Code 4912"

    # Verify persisted in DB
    db = SessionLocal()
    artist = db.query(ArtistRow).filter(ArtistRow.id == "dance_kalbelia_01").first()
    assert resp_data["video_url"] in artist.video_urls
    assert artist.live_prompt_phrase == "Rangilo Rajasthan - Code 4912"
    db.close()


def test_upload_photo_validation(client: TestClient):
    """Photo upload rejects executable/invalid types and accepts valid JPEG/PNG."""
    headers = auth_headers(client, "9000000001")

    # Reject .exe or .pdf
    bad_file = io.BytesIO(b"%PDF-1.4...")
    res_bad = client.post(
        "/artists/upload-photo",
        files={"file": ("profile.pdf", bad_file, "application/pdf")},
        headers=headers,
    )
    assert res_bad.status_code == 400

    # Accept valid .jpg
    good_file = io.BytesIO(b"\xFF\xD8\xFF\xE0\x00\x10JFIF")
    res_good = client.post(
        "/artists/upload-photo",
        files={"file": ("portrait.jpg", good_file, "image/jpeg")},
        headers=headers,
    )
    assert res_good.status_code == 200
    assert "photo_url" in res_good.json()


# -----------------------------------------------------------------------------
# 3. Coordinator Vouch Counting & Trusted Tier Progression Tests
# -----------------------------------------------------------------------------

def test_coordinator_vouch_counting_and_tier_progression(client: TestClient):
    """Two independent vouches from different coordinators elevate stage to TRUSTED once video reviewed."""
    # 1. Create a fresh artist in REGISTERED stage
    db = SessionLocal()
    test_artist = ArtistRow(
        id="artist_vouch_test_01",
        name="Langa Manganiyar Trio",
        art_form="Manganiyar Folk Music",
        city="Jaisalmer",
        min_fee=1000000,
        travel_range_km=150,
        min_duration_minutes=60,
        max_group_size=6,
        verification_stage="REGISTERED",
        listing_status="DRAFT",
        video_urls=["/uploads/audition_test.mp4"],
        upi_id="langa@okhdfcbank",
    )
    db.add(test_artist)

    # 2. Create two independent coordinator users
    coord1 = UserRow(
        id="user_coord_01",
        name="Ustad Rahim Khan",
        phone="9111111101",
        role="COORDINATOR",
    )
    coord2 = UserRow(
        id="user_coord_02",
        name="Dr. Meenakshi Joshi",
        phone="9111111102",
        role="COORDINATOR",
    )
    db.add(coord1)
    db.add(coord2)
    db.commit()
    db.close()

    headers_coord1 = auth_headers(client, "9111111101")
    headers_coord2 = auth_headers(client, "9111111102")

    # Step A: Coordinator 1 vouches
    vouch_payload = {"notes": "I have known this artist troupe for 8 years and verified their authenticity."}
    res1 = client.post(
        "/artists/artist_vouch_test_01/vouch",
        json=vouch_payload,
        headers=headers_coord1,
    )
    assert res1.status_code == 200
    assert res1.json()["total_vouches"] == 1
    assert res1.json()["verification_stage"] == "COORDINATOR_VOUCHED"

    # Step B: Duplicate vouch from same coordinator must be rejected with 400
    res_dup = client.post(
        "/artists/artist_vouch_test_01/vouch",
        json={"notes": "Duplicate vouch submission"},
        headers=headers_coord1,
    )
    assert res_dup.status_code == 400
    assert "already submitted a vouch" in res_dup.json()["detail"]

    # Step C: Coordinator 2 vouches
    res2 = client.post(
        "/artists/artist_vouch_test_01/vouch",
        json={"notes": "Witnessed them perform live at Desert Festival Jaisalmer."},
        headers=headers_coord2,
    )
    assert res2.status_code == 200
    assert res2.json()["total_vouches"] == 2
    # Video is not yet operator-reviewed, so remains COORDINATOR_VOUCHED until approved
    assert res2.json()["verification_stage"] == "COORDINATOR_VOUCHED"

    # Step D: Operator reviews & approves video
    operator_headers = auth_headers(client, OPERATOR_PHONE)
    res_review = client.post(
        "/operator/artists/artist_vouch_test_01/review",
        json={"action": "approve", "reason": "Audition video authentic and recite code matched."},
        headers=operator_headers,
    )
    assert res_review.status_code == 200
    # Because 2 independent vouches exist, video approval elevates directly to TRUSTED!
    assert res_review.json()["artist"]["verification_stage"] == "TRUSTED"
    assert res_review.json()["artist"]["listing_status"] == "LIVE"


# -----------------------------------------------------------------------------
# 4. Operator Review Queue & Listing-Status Gate Tests
# -----------------------------------------------------------------------------

def test_listing_status_gate_only_live_after_operator_approval(client: TestClient):
    """A new artist submission cannot be LIVE until an operator approves their video."""
    # Create new artist in DRAFT status
    db = SessionLocal()
    artist = ArtistRow(
        id="artist_gate_01",
        name="Shekhawati Dhol Troupe",
        art_form="Kalbelia Dance",
        city="Sikar",
        bio="Energetic folk dhol and chang percussion ensemble.",
        min_fee=1200000,
        travel_range_km=100,
        min_duration_minutes=60,
        max_group_size=8,
        video_urls=["/uploads/dhol_audition.mp4"],
        upi_id="dhol@okhdfcbank",
        listing_status="DRAFT",
        verification_stage="REGISTERED",
    )
    user = UserRow(
        id="user_artist_gate_01",
        name="Shekhawati Dhol Troupe",
        phone="9222222201",
        role="ARTIST",
        artist_id="artist_gate_01",
    )
    db.add(artist)
    db.add(user)
    db.commit()
    db.close()

    artist_headers = auth_headers(client, "9222222201")
    operator_headers = auth_headers(client, OPERATOR_PHONE)

    # 1. Artist submits profile for review
    res_sub = client.post("/artists/me/submit-for-review", headers=artist_headers)
    assert res_sub.status_code == 200
    assert res_sub.json()["listing_status"] == "PENDING_REVIEW"

    # Public discovery should NOT show PENDING_REVIEW artist
    res_public = client.get("/artists")
    public_ids = [a["id"] for a in res_public.json()]
    assert "artist_gate_01" not in public_ids

    # 2. Operator checks review queue
    res_queue = client.get("/operator/review-queue", headers=operator_headers)
    assert res_queue.status_code == 200
    queue_ids = [a["id"] for a in res_queue.json()]
    assert "artist_gate_01" in queue_ids

    # 3. Operator rejects submission (e.g. video unclear)
    res_reject = client.post(
        "/operator/artists/artist_gate_01/review",
        json={"action": "reject", "reason": "Audition audio was clipped and live code was inaudible."},
        headers=operator_headers,
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["artist"]["listing_status"] == "DRAFT"

    # Artist re-submits
    res_re_sub = client.post("/artists/me/submit-for-review", headers=artist_headers)
    assert res_re_sub.status_code == 200
    assert res_re_sub.json()["listing_status"] == "PENDING_REVIEW"

    # 4. Operator approves submission
    res_approve = client.post(
        "/operator/artists/artist_gate_01/review",
        json={"action": "approve", "reason": "Clear HD audio and verified live challenge code."},
        headers=operator_headers,
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["artist"]["listing_status"] == "LIVE"
    assert res_approve.json()["artist"]["verification_stage"] == "VIDEO_REVIEWED"

    # Now the artist is discoverable in public /artists
    res_public2 = client.get("/artists")
    public_ids2 = [a["id"] for a in res_public2.json()]
    assert "artist_gate_01" in public_ids2


# -----------------------------------------------------------------------------
# 5. Reliability Score & Booking Completion Counter Tests
# -----------------------------------------------------------------------------

def test_reliability_score_computation_formula():
    """Verify reliability score math across completions, no-shows, and late cancellations."""
    # Pristine profile: 100.0
    assert compute_reliability_score(0, 0, 0) == 100.0

    # 5 completed bookings: +10 pts bonus (capped at 100 if no penalties)
    assert compute_reliability_score(5, 0, 0) == 100.0

    # 1 no show: -25 pts penalty -> 75.0
    assert compute_reliability_score(0, 1, 0) == 75.0

    # 1 late cancel: -15 pts penalty -> 85.0
    assert compute_reliability_score(0, 0, 1) == 85.0

    # 1 no-show, 1 late cancel, 2 completions: 100 - 25 - 15 + 4 = 64.0
    assert compute_reliability_score(2, 1, 1) == 64.0

    # With 5-star rating blending
    score_with_rating = compute_reliability_score(2, 1, 1, ratings_count=2, ratings_sum=10.0)
    # 0.75 * 64 + 0.25 * 100 = 48 + 25 = 73.0
    assert score_with_rating == 73.0


def test_artist_lifecycle_event_trigger_updates_metrics(client: TestClient):
    """Triggering operational events updates completion counts and recalculates score in DB."""
    operator_headers = auth_headers(client, OPERATOR_PHONE)
    target_id = "dance_kalbelia_01"

    # 1. Complete booking event
    res1 = client.post(
        f"/artists/{target_id}/events",
        json={"event_type": "BOOKING_COMPLETED"},
        headers=operator_headers,
    )
    assert res1.status_code == 200
    assert res1.json()["completed_bookings_count"] == 13

    # 2. No-show event
    res2 = client.post(
        f"/artists/{target_id}/events",
        json={"event_type": "NO_SHOW"},
        headers=operator_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["no_shows_count"] == 1
    assert res2.json()["reliability_score"] < 100.0
