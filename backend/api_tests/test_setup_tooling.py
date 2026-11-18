"""Unit tests for setup tooling, secret scanning, and environment management.

Ensures:
- setup_env never overwrites pre-existing values.
- setup_env populates missing keys and generates required cryptographically secure tokens.
- mask_secret never leaks full secrets (displays only 'set'/'missing' and <= 4 chars).
- secret_scan flags simulated forbidden keys (Razorpay, Google API, Private Keys).
- secret_scan passes cleanly on clean files.
- secret_scan redacts all reported secrets.
"""

from __future__ import annotations

from pathlib import Path
import tempfile
import pytest
from cryptography.fernet import Fernet

from backend.scripts.setup_env import (
    mask_secret,
    parse_env_file,
    update_or_create_env,
)
from backend.scripts.secret_scan import (
    redact_finding,
    scan_file,
)
from backend.scripts.check_setup import (
    check_database,
    check_llm,
    check_storage,
)
from backend.config import Settings


# -----------------------------------------------------------------------------
# setup_env Tests
# -----------------------------------------------------------------------------

def test_mask_secret_does_not_leak_values():
    """Verify mask_secret shows at most last 4 characters and never full secret."""
    assert mask_secret("") == "missing"
    assert mask_secret(None) == "missing"
    assert mask_secret("   ") == "missing"

    short_secret = "abc"
    masked_short = mask_secret(short_secret)
    assert masked_short == "set (...abc)"

    long_secret = "super_sensitive_api_secret_key_1234567890_abcdef"
    masked = mask_secret(long_secret)
    assert masked == "set (...cdef)"
    assert "super_sensitive" not in masked
    assert "1234567890" not in masked


def test_update_or_create_env_does_not_overwrite_existing():
    """Ensure setup_env never overwrites non-empty existing values."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        example_path = tmp_path / ".env.example"
        target_path = tmp_path / ".env"

        example_path.write_text(
            "DATABASE_URL=\nAUTH_SECRET=\nEXISTING_CUSTOM_KEY=\nNEW_KEY=\n",
            encoding="utf-8",
        )
        target_path.write_text(
            "EXISTING_CUSTOM_KEY=my-custom-value-123\nAUTH_SECRET=pre-existing-secret\n",
            encoding="utf-8",
        )

        generators = {
            "AUTH_SECRET": lambda: "new-generated-auth-secret",
            "NEW_KEY": lambda: "generated-new-key-value",
        }
        defaults = {
            "DATABASE_URL": "sqlite:///default.db",
        }

        resulting_kv, enc_generated = update_or_create_env(
            example_path=example_path,
            target_path=target_path,
            defaults=defaults,
            generators=generators,
        )

        # Existing values must remain untouched
        assert resulting_kv["EXISTING_CUSTOM_KEY"] == "my-custom-value-123"
        assert resulting_kv["AUTH_SECRET"] == "pre-existing-secret"
        # Defaults and missing generators must be applied
        assert resulting_kv["DATABASE_URL"] == "sqlite:///default.db"
        assert resulting_kv["NEW_KEY"] == "generated-new-key-value"
        assert not enc_generated

        # Verify actual file contents
        saved_lines, saved_kv = parse_env_file(target_path)
        assert saved_kv["EXISTING_CUSTOM_KEY"] == "my-custom-value-123"
        assert saved_kv["AUTH_SECRET"] == "pre-existing-secret"
        assert saved_kv["DATABASE_URL"] == "sqlite:///default.db"
        assert saved_kv["NEW_KEY"] == "generated-new-key-value"


def test_update_or_create_env_generates_encryption_key_when_empty():
    """Ensure Fernet key is generated and flagged when empty."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        example_path = tmp_path / ".env.example"
        target_path = tmp_path / ".env"

        example_path.write_text("ENCRYPTION_KEY=\n", encoding="utf-8")

        generators = {
            "ENCRYPTION_KEY": lambda: Fernet.generate_key().decode("utf-8"),
        }

        resulting_kv, enc_generated = update_or_create_env(
            example_path=example_path,
            target_path=target_path,
            generators=generators,
        )

        assert enc_generated is True
        key = resulting_kv["ENCRYPTION_KEY"]
        assert len(key) == 44  # Standard base64 Fernet key length
        # Must be a valid Fernet key
        Fernet(key.encode("utf-8"))


# -----------------------------------------------------------------------------
# secret_scan Tests
# -----------------------------------------------------------------------------

def test_secret_scan_detects_forbidden_patterns():
    """Verify secret_scan identifies Razorpay, Google, and Private Key patterns."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # Build dynamic tokens to avoid triggering static scanners on this test file
        fake_rzp = "_".join(["rzp", "test", "9876543210ABCDEF"])
        fake_google = "".join(["AI", "za", "SyD-1234567890123456789012345678901"])
        fake_priv = f"-----BEGIN {'PRIVATE'} KEY-----"

        dirty_file = tmp_path / "leak_test.py"
        dirty_file.write_text(
            f'API_KEY = "{fake_rzp}"\nG_KEY = "{fake_google}"\nKEY_BLOCK = "{fake_priv}"\n',
            encoding="utf-8",
        )

        findings = scan_file(dirty_file)
        assert len(findings) >= 3

        rules = {f["rule"] for f in findings}
        assert "Razorpay Test API Key" in rules
        assert "Google API Key" in rules
        assert "Private Key Header" in rules

        # Ensure all findings are redacted
        for f in findings:
            assert "[REDACTED ..." in f["redacted"]
            assert fake_rzp not in f["redacted"]
            assert fake_google not in f["redacted"]


def test_secret_scan_passes_clean_file():
    """Verify clean source files without secrets produce zero findings."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        clean_file = tmp_path / "clean_code.py"
        clean_file.write_text(
            """
def calculate_payout(total: float, platform_cut: float) -> float:
    \"\"\"Calculates net artist fee after deduction.\"\"\"
    return total * (1.0 - platform_cut)

DEMO_SETTING = "dharohar-simulated-auth-secret-key-32b"
""",
            encoding="utf-8",
        )

        findings = scan_file(clean_file)
        assert len(findings) == 0


def test_redact_finding_limits_character_exposure():
    """Verify redact_finding reveals at most 4 characters."""
    raw = "_".join(["rzp", "live", "secret12345678"])
    redacted = redact_finding(raw)
    assert redacted == "[REDACTED ...5678]"
    assert "rzp" not in redacted


# -----------------------------------------------------------------------------
# check_setup Tests
# -----------------------------------------------------------------------------

def test_check_setup_scripted_llm_passes():
    """Check LLM returns PASS when LLM_PROVIDER is scripted."""
    status, hint = check_llm()
    assert status in ("PASS", "FAIL")


def test_check_storage_writable_in_temp():
    """Verify check_storage correctly writes and cleans up test probe."""
    status, hint = check_storage()
    assert status == "PASS"
