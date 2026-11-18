"""Dharohar Diagnostics & Setup Health Check Runner.

Runs independent health checks for all subsystems:
- Environment (.env existence and loading)
- Database (SQLAlchemy connection and query probe)
- LLM (scripted mock or provider key format)
- Firebase (service account credentials file validation)
- Storage (directory writability or cloud bucket)
- Razorpay (key ID and secret format)
- WhatsApp (access token and phone number ID format)
- Webhooks (public HTTPS URL validation)

Prints a clean summary table without leaking any secret values.
Exits with 0 if no FAILs, or 1 if any check fails.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Dict, List, Tuple

from sqlalchemy import create_engine, text

from backend.config import PROJECT_ROOT, BACKEND_DIR, settings


def check_environment() -> Tuple[str, str]:
    """Verify backend/.env exists and is not empty."""
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return "FAIL", "backend/.env missing. Run: python -m backend.scripts.setup_env"
    if env_path.stat().st_size == 0:
        return "FAIL", "backend/.env is empty. Run: python -m backend.scripts.setup_env"
    return "PASS", "backend/.env exists and configuration loaded"


def check_database() -> Tuple[str, str]:
    """Connect to database and execute a probe query (SELECT 1)."""
    db_url = settings.DATABASE_URL
    try:
        engine = create_engine(db_url, connect_args={"check_same_thread": False} if "sqlite" in db_url else {})
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result != 1:
                return "FAIL", f"Unexpected query result ({result}) on {db_url}"
        return "PASS", f"Connected successfully, executed SELECT 1"
    except Exception as ex:
        return "FAIL", f"Database error ({type(ex).__name__}). Run: python -m backend.seed"


def check_llm() -> Tuple[str, str]:
    """Check LLM provider settings and key format without leaking secrets."""
    provider = settings.LLM_PROVIDER
    if provider == "scripted":
        return "PASS", "Scripted mock provider active (offline deterministic demo)"

    if provider == "gemini":
        key = settings.GEMINI_API_KEY or settings.LLM_API_KEY
        if not key or not key.strip():
            return "FAIL", "Missing GEMINI_API_KEY or LLM_API_KEY in backend/.env"
        k = key.strip()
        if len(k) < 15:
            return "FAIL", "Gemini API key is invalid format (too short)"
        return "PASS", f"Gemini provider configured ({settings.GEMINI_MODEL})"

    if provider in ("claude", "anthropic"):
        key = settings.ANTHROPIC_API_KEY or settings.LLM_API_KEY
        if not key or not key.strip():
            return "FAIL", "Missing ANTHROPIC_API_KEY or LLM_API_KEY in backend/.env"
        k = key.strip()
        if not k.startswith("sk-ant-") and len(k) < 15:
            return "FAIL", "Anthropic API key format invalid"
        return "PASS", f"Anthropic provider configured ({settings.ANTHROPIC_MODEL})"

    if provider in ("openai", "groq", "deepseek"):
        key = settings.LLM_API_KEY
        if not key or not key.strip():
            return "FAIL", f"Missing LLM_API_KEY for provider '{provider}'"
        return "PASS", f"{provider.title()} provider key configured"

    return "FAIL", f"Unknown LLM_PROVIDER '{provider}'. Allowed: scripted, gemini, anthropic"


def check_firebase() -> Tuple[str, str]:
    """Verify Firebase service account credentials file if configured."""
    cred_path = settings.FIREBASE_CREDENTIALS_PATH
    if not cred_path or not cred_path.strip():
        return "SKIPPED", "FIREBASE_CREDENTIALS_PATH not set (optional in demo mode)"

    p = Path(cred_path.strip())
    if not p.is_absolute():
        p = (PROJECT_ROOT / p).resolve()

    if not p.exists():
        return "FAIL", f"Credentials file not found at {cred_path}"

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return "FAIL", "Credentials JSON root must be an object"
        if "project_id" not in data and "type" not in data:
            return "FAIL", "Credentials JSON missing 'project_id' or 'type'"
        return "PASS", "Firebase service account credentials valid JSON"
    except Exception as ex:
        return "FAIL", f"Invalid JSON in Firebase credentials: {ex}"


def check_storage() -> Tuple[str, str]:
    """Verify upload directory writability or cloud bucket configuration."""
    if settings.STORAGE_BUCKET_NAME and settings.STORAGE_BUCKET_NAME.strip():
        return "PASS", f"Cloud storage bucket configured: {settings.STORAGE_BUCKET_NAME.strip()}"

    upload_dir = Path(settings.UPLOAD_DIR)
    if not upload_dir.is_absolute():
        upload_dir = (PROJECT_ROOT / upload_dir).resolve()

    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        probe_file = upload_dir / ".storage_writability_probe"
        probe_file.write_text("probe", encoding="utf-8")
        probe_file.unlink()
        return "PASS", f"Local upload directory writable: {settings.UPLOAD_DIR}"
    except Exception as ex:
        return "FAIL", f"Upload directory not writable ({settings.UPLOAD_DIR}): {ex}"


def check_razorpay() -> Tuple[str, str]:
    """Verify Razorpay Key ID and Secret format without leaking secrets."""
    key_id = (settings.RAZORPAY_KEY_ID or "").strip()
    key_secret = (settings.RAZORPAY_KEY_SECRET or "").strip()

    if not key_id and not key_secret:
        return "SKIPPED", "Razorpay credentials not set (optional in demo mode)"

    if not key_id:
        return "FAIL", "RAZORPAY_KEY_ID missing while secret is set"
    if not key_secret:
        return "FAIL", "RAZORPAY_KEY_SECRET missing while key ID is set"

    if not (key_id.startswith("rzp_test_") or key_id.startswith("rzp_live_")):
        return "FAIL", "RAZORPAY_KEY_ID must start with rzp_test_ or rzp_live_"

    if len(key_id) < 14:
        return "FAIL", "RAZORPAY_KEY_ID length invalid"

    return "PASS", "Razorpay credentials format verified (rzp_test/rzp_live)"


def check_whatsapp() -> Tuple[str, str]:
    """Verify WhatsApp Cloud API credentials format."""
    token = (settings.WHATSAPP_TOKEN or "").strip()
    phone_id = (settings.WHATSAPP_PHONE_ID or settings.WHATSAPP_PHONE_NUMBER_ID or "").strip()

    if not token and not phone_id:
        return "SKIPPED", "WhatsApp credentials not set (optional in demo mode)"

    if not token:
        return "FAIL", "WHATSAPP_TOKEN is missing"
    if not phone_id:
        return "FAIL", "WHATSAPP_PHONE_ID is missing"

    if not phone_id.isdigit():
        return "FAIL", "WHATSAPP_PHONE_ID must contain digits only"

    if len(token) < 20:
        return "FAIL", "WHATSAPP_TOKEN format invalid (token too short)"

    return "PASS", "WhatsApp credentials format verified"


def check_webhooks() -> Tuple[str, str]:
    """Check webhook public base URL configuration."""
    url = (settings.PUBLIC_BASE_URL or "").strip()
    if not url:
        return "SKIPPED", "PUBLIC_BASE_URL not set (optional for local offline demo)"

    url_lower = url.lower()
    if "localhost" in url_lower or "127.0.0.1" in url_lower:
        return "FAIL", "PUBLIC_BASE_URL is localhost; external webhooks require a public HTTPS URL (e.g. ngrok)"

    if not url.startswith("https://"):
        return "FAIL", "PUBLIC_BASE_URL must begin with https://"

    return "PASS", f"Public webhook URL configured ({url[:16]}...)"


def run_all_checks() -> Tuple[List[Dict[str, str]], bool]:
    """Run diagnostics and return formatted results table."""
    checks: List[Tuple[str, callable]] = [
        ("Environment", check_environment),
        ("Database", check_database),
        ("LLM", check_llm),
        ("Firebase", check_firebase),
        ("Storage", check_storage),
        ("Razorpay", check_razorpay),
        ("WhatsApp", check_whatsapp),
        ("Webhooks", check_webhooks),
    ]

    results: List[Dict[str, str]] = []
    has_failure = False

    for service_name, check_fn in checks:
        try:
            status, hint = check_fn()
        except Exception as ex:
            status, hint = "FAIL", f"Unexpected check error: {ex}"

        if status == "FAIL":
            has_failure = True

        results.append({
            "service": service_name,
            "status": status,
            "hint": hint,
        })

    return results, has_failure


def print_summary_table(results: List[Dict[str, str]], has_failure: bool) -> None:
    """Print clean ASCII summary table and next developer steps."""
    print("=" * 80)
    print("Dharohar System Diagnostics & Health Check")
    print("=" * 80)

    col1 = 15
    col2 = 10
    col3 = 50

    border = f"+{'-' * (col1 + 2)}+{'-' * (col2 + 2)}+{'-' * (col3 + 2)}+"
    print(border)
    print(f"| {'Service':<{col1}} | {'Status':<{col2}} | {'Details / Fix Hint':<{col3}} |")
    print(border)

    for r in results:
        hint_text = r["hint"]
        if len(hint_text) > col3:
            hint_text = hint_text[:col3 - 3] + "..."
        print(f"| {r['service']:<{col1}} | {r['status']:<{col2}} | {hint_text:<{col3}} |")

    print(border)

    print("\nNext Manual Steps:")
    print("--------------------------------------------------------------------------------")
    print("1. LLM Negotiation:")
    print("   To switch from scripted demo to live AI, set LLM_PROVIDER=gemini (or anthropic)")
    print("   and LLM_API_KEY in backend/.env.")
    print("2. Payments (Razorpay):")
    print("   For test payments, get Test Key ID & Secret from Razorpay Dashboard and set")
    print("   RAZORPAY_KEY_ID=rzp_test_... and RAZORPAY_KEY_SECRET in backend/.env.")
    print("3. WhatsApp Notifications:")
    print("   To test WhatsApp messages, set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.")
    print("4. External Webhooks:")
    print("   For incoming Razorpay/WhatsApp webhooks, run 'ngrok http 8000' and set")
    print("   PUBLIC_BASE_URL=https://<your-subdomain>.ngrok-free.app in backend/.env.")
    print("5. Git Pre-Commit Security Hook:")
    print("   Activate automatic secret scanning before commits by running:")
    print("   git config core.hooksPath scripts/hooks")
    print("--------------------------------------------------------------------------------\n")


def main() -> None:
    results, has_failure = run_all_checks()
    print_summary_table(results, has_failure)
    sys.exit(1 if has_failure else 0)


if __name__ == "__main__":
    main()
