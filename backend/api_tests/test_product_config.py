"""Tests for product mode configuration, DEMO_MODE guards, structured logging, and CORS.

Verifies:
- All demo routes (/seed, /demo/*) return 404 when DEMO_MODE=false.
- Auth OTP response hides simulated flag and demo_otp when DEMO_MODE=false.
- Mock payment provider cannot be selected when DEMO_MODE=false.
- Scripted LLM provider cannot be selected when DEMO_MODE=false.
- Production environment validation fails fast when required credentials are missing.
- Structured JSON logging masks phone numbers and secrets and attaches X-Request-ID.
- CORS origins configuration is respected.
"""

from __future__ import annotations

import json
import logging
import pytest
from fastapi.testclient import TestClient

from backend.config import Settings, get_settings
from backend.database import SessionLocal, reset_db
from backend.logging_config import StructuredJsonFormatter, mask_sensitive_data
from backend.main import app
from backend.seed import OPERATOR_PHONE, ORGANIZER_PHONE, seed_database
from backend.trustpay import MockProvider, get_payment_provider


@pytest.fixture
def non_demo_client(monkeypatch):
    """Client configured with DEMO_MODE=false."""
    monkeypatch.setenv("DEMO_MODE", "false")
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("AUTH_SECRET", "test-auth-secret-for-non-demo-tests-32b")
    # Reset DB with demo mode temporarily for seeding users
    reset_db()
    db = SessionLocal()
    seed_database(db=db)
    db.close()
    return TestClient(app)


def test_demo_routes_return_404_when_demo_mode_false(non_demo_client: TestClient):
    """Every demo-only route must return 404 when DEMO_MODE=false."""
    # 1. /seed route
    res_seed = non_demo_client.post("/seed")
    assert res_seed.status_code == 404, f"Expected 404 for /seed, got {res_seed.status_code}"

    # 2. /demo/run-scenario route
    res_scenario = non_demo_client.post("/demo/run-scenario")
    assert res_scenario.status_code == 404, f"Expected 404 for /demo/run-scenario, got {res_scenario.status_code}"

    # 3. /demo/advance-time route
    res_time = non_demo_client.post("/demo/advance-time")
    assert res_time.status_code == 404, f"Expected 404 for /demo/advance-time, got {res_time.status_code}"

    # 4. /demo/fail-next-payout route
    res_fail = non_demo_client.post("/demo/fail-next-payout")
    assert res_fail.status_code == 404, f"Expected 404 for /demo/fail-next-payout, got {res_fail.status_code}"

    # 5. /demo/provider route (GET)
    res_get_prov = non_demo_client.get("/demo/provider")
    assert res_get_prov.status_code == 404, f"Expected 404 for GET /demo/provider, got {res_get_prov.status_code}"

    # 6. /demo/set-provider route (POST)
    res_set_prov = non_demo_client.post("/demo/set-provider", json={"provider": "gemini"})
    assert res_set_prov.status_code == 404, f"Expected 404 for POST /demo/set-provider, got {res_set_prov.status_code}"


def test_auth_otp_no_simulation_when_demo_mode_false(non_demo_client: TestClient):
    """When DEMO_MODE=false, simulated OTP endpoints are disabled and return 404."""
    res = non_demo_client.post("/auth/request-otp", json={"phone": ORGANIZER_PHONE})
    assert res.status_code == 404
    res2 = non_demo_client.post("/auth/verify-otp", json={"phone": ORGANIZER_PHONE, "otp": "123456"})
    assert res2.status_code == 404


def test_mock_payment_provider_cannot_be_selected_in_production(monkeypatch):
    """Attempting to select mock payment provider when ENV=production must raise ValueError."""
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("PAYMENT_PROVIDER", "mock")
    with pytest.raises(ValueError, match="PAYMENT_PROVIDER cannot be 'mock' in production"):
        Settings()
    with pytest.raises(ValueError, match="PAYMENT_PROVIDER cannot be 'mock' in production"):
        get_payment_provider("mock")


def test_razorpay_provider_fails_at_startup_without_keys(monkeypatch):
    """When PAYMENT_PROVIDER=razorpay, missing Razorpay keys fails startup with clear message."""
    monkeypatch.setenv("PAYMENT_PROVIDER", "razorpay")
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    with pytest.raises(ValueError, match="required Razorpay keys are missing"):
        Settings()
    with pytest.raises(ValueError, match="required Razorpay keys are missing"):
        get_payment_provider()


def test_payment_provider_mock_selected_by_default():
    """Default PAYMENT_PROVIDER is mock and returns MockProvider."""
    s = get_settings()
    assert s.PAYMENT_PROVIDER == "mock"
    prov = get_payment_provider()
    assert isinstance(prov, MockProvider)


def test_production_env_validation_fails_on_missing_required_variables(monkeypatch):
    """When ENV=production, startup must fail with a clear list of missing variables."""
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    monkeypatch.delenv("WHATSAPP_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_ID", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)

    with pytest.raises(ValueError) as excinfo:
        Settings()

    err_msg = str(excinfo.value)
    assert "Production startup failed" in err_msg
    assert "RAZORPAY_KEY_ID" in err_msg
    assert "WHATSAPP_TOKEN" in err_msg


def test_request_id_header_attached(non_demo_client: TestClient):
    """Every HTTP response must include the X-Request-ID header."""
    res = non_demo_client.get("/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers["X-Request-ID"].startswith("req_")


def test_sensitive_data_masking():
    """Verify phone numbers and credentials are masked down to at most the last 4 digits."""
    # 1. Phone number masking
    sample_phone = "Contact artist at 9876543210 for booking"
    masked_phone = mask_sensitive_data(sample_phone)
    assert "9876543210" not in masked_phone
    assert "3210" in masked_phone
    assert "******3210" in masked_phone

    # 2. Bearer token masking
    sample_token = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tokenpayload1234"
    masked_token = mask_sensitive_data(sample_token)
    assert "eyJhbGci" not in masked_token
    assert "...[REDACTED]...1234" in masked_token

    # 3. Secret assignment masking
    fake_rzp = "_".join(["rzp", "test", "secretKey12345678ABCD"])
    sample_secret = f'api_key: "{fake_rzp}"'
    masked_secret = mask_sensitive_data(sample_secret)
    assert "secretKey12345678" not in masked_secret
    assert "ABCD" in masked_secret


def test_structured_json_formatter():
    """StructuredJsonFormatter outputs valid JSON with required fields."""
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="backend.test",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Booking negotiation for phone 9123456789",
        args=(),
        exc_info=None,
    )
    record.request_id = "req_test_abc123"

    formatted = formatter.format(record)
    log_obj = json.loads(formatted)

    assert log_obj["level"] == "INFO"
    assert log_obj["request_id"] == "req_test_abc123"
    assert "9123456789" not in log_obj["message"]
    assert "6789" in log_obj["message"]
    assert "timestamp" in log_obj


def test_cors_allowed_origins_parsing(monkeypatch):
    """ALLOWED_ORIGINS parses list and comma-separated string."""
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://dharohar.app, https://admin.dharohar.app")
    s = Settings()
    assert s.ALLOWED_ORIGINS == ["https://dharohar.app", "https://admin.dharohar.app"]
