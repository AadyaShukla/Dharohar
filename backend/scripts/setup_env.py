"""Interactive and safe environment configuration script for Dharohar.

Ensures backend/.env and frontend/.env are created from their respective .env.example
templates without overwriting existing values. Generates secure cryptographic
secrets when keys are blank.

Security rule: NEVER print, log or echo full secret values. Mask all displays.
"""

from __future__ import annotations

import os
from pathlib import Path
import re
import secrets
from typing import Dict, List, Tuple

from cryptography.fernet import Fernet


def mask_secret(value: str | None) -> str:
    """Mask secret values displaying at most 'set' / 'missing' and the last 4 chars."""
    if not value or not value.strip():
        return "missing"
    val = value.strip()
    if len(val) <= 4:
        return f"set (...{val})"
    return f"set (...{val[-4:]})"


def parse_env_file(path: Path) -> Tuple[List[str], Dict[str, str]]:
    """Parse an .env or .env.example file into raw lines and key-value mapping."""
    if not path.exists():
        return [], {}

    lines = path.read_text(encoding="utf-8").splitlines()
    kv: Dict[str, str] = {}
    key_pattern = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")

    for line in lines:
        match = key_pattern.match(line)
        if match:
            k, v = match.group(1), match.group(2).strip()
            # Strip outer quotes if present
            if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            kv[k] = v

    return lines, kv


def update_or_create_env(
    example_path: Path,
    target_path: Path,
    defaults: Dict[str, str] | None = None,
    generators: Dict[str, callable] | None = None,
    inherited_values: Dict[str, str] | None = None,
) -> Tuple[Dict[str, str], bool]:
    """Create or update target env file from example template without overwriting.

    Returns:
        (resulting_kv, encryption_key_generated)
    """
    defaults = defaults or {}
    generators = generators or {}
    inherited_values = inherited_values or {}

    example_lines, example_kv = parse_env_file(example_path)
    target_exists = target_path.exists()
    target_lines, target_kv = parse_env_file(target_path) if target_exists else ([], {})

    new_kv: Dict[str, str] = dict(target_kv)
    encryption_key_generated = False

    # Check which keys need initialization or generation
    for key in example_kv:
        current_val = target_kv.get(key, "").strip() if target_exists else ""

        # If empty and we have an inherited value (e.g. from root .env)
        if not current_val and key in inherited_values and inherited_values[key].strip():
            current_val = inherited_values[key].strip()

        # If still empty and generator exists
        if not current_val and key in generators:
            current_val = generators[key]()
            if key == "ENCRYPTION_KEY":
                encryption_key_generated = True

        # If still empty and default exists
        if not current_val and key in defaults:
            current_val = defaults[key]

        new_kv[key] = current_val

    # Construct file content:
    # If target didn't exist, we populate template preserving comments
    if not target_exists:
        out_lines: List[str] = []
        key_pattern = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=")
        for line in example_lines:
            match = key_pattern.match(line)
            if match:
                k = match.group(1)
                val = new_kv.get(k, "")
                out_lines.append(f"{k}={val}")
            else:
                out_lines.append(line)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    else:
        # Target already exists: preserve all existing lines, update empty generated keys, append missing
        out_lines = []
        key_pattern = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")
        processed_keys = set()

        for line in target_lines:
            match = key_pattern.match(line)
            if match:
                k = match.group(1)
                processed_keys.add(k)
                # Keep existing non-empty value; if it was empty and we generated/defaulted a value, fill it
                existing_val = match.group(2).strip()
                if not existing_val and k in new_kv and new_kv[k]:
                    out_lines.append(f"{k}={new_kv[k]}")
                else:
                    out_lines.append(line)
            else:
                out_lines.append(line)

        # Append any completely missing keys from example
        missing_keys = [k for k in example_kv if k not in processed_keys]
        if missing_keys:
            out_lines.append("\n# Added missing configuration keys")
            for k in missing_keys:
                out_lines.append(f"{k}={new_kv.get(k, '')}")

        target_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")

    return new_kv, encryption_key_generated


def setup_environment(project_root: Path | None = None) -> bool:
    """Orchestrate safe setup for backend/.env and frontend/.env."""
    if project_root is None:
        project_root = Path(__file__).resolve().parent.parent.parent

    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"

    backend_env_example = backend_dir / ".env.example"
    backend_env = backend_dir / ".env"
    frontend_env_example = frontend_dir / ".env.example"
    frontend_env = frontend_dir / ".env"
    root_env = project_root / ".env"

    _, root_kv = parse_env_file(root_env) if root_env.exists() else ([], {})

    backend_generators = {
        "AUTH_SECRET": lambda: secrets.token_urlsafe(48),
        "RAZORPAY_WEBHOOK_SECRET": lambda: secrets.token_urlsafe(32),
        "WHATSAPP_VERIFY_TOKEN": lambda: secrets.token_urlsafe(24),
        "ENCRYPTION_KEY": lambda: Fernet.generate_key().decode("utf-8"),
    }

    backend_defaults = {
        "ENV": "development",
        "DATABASE_URL": "sqlite:///backend/dharohar.db",
        "DEMO_MODE": "false",
        "LLM_PROVIDER": "gemini",
        "LLM_MODEL": "gemini-2.5-flash",
        "GEMINI_MODEL": "gemini-2.5-flash",
        "ANTHROPIC_MODEL": "claude-3-5-sonnet-20241022",
        "ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:3000",
        "UPLOAD_DIR": "backend/uploads",
    }

    print("================================================================================")
    print("Dharohar Environment Setup")
    print("================================================================================")

    # 1. Backend environment configuration
    print(f"\n[1/2] Configuring backend environment: {backend_env.relative_to(project_root)}")
    backend_kv, enc_generated = update_or_create_env(
        example_path=backend_env_example,
        target_path=backend_env,
        defaults=backend_defaults,
        generators=backend_generators,
        inherited_values=root_kv,
    )

    for k in sorted(backend_kv.keys()):
        status = mask_secret(backend_kv[k])
        print(f"  - {k:<26}: {status}")

    if enc_generated:
        print("\n" + "!" * 80)
        print("CRITICAL WARNING:")
        print("A new ENCRYPTION_KEY was generated and written to backend/.env.")
        print("BACK UP THIS KEY: if lost, existing encrypted fields cannot be decrypted.")
        print("!" * 80)

    # 2. Frontend environment configuration
    frontend_defaults = {
        "VITE_API_URL": "http://localhost:8000",
        "VITE_APP_TITLE": "Dharohar",
        "VITE_DEMO_MODE": "true",
    }

    print(f"\n[2/2] Configuring frontend environment: {frontend_env.relative_to(project_root)}")
    frontend_kv, _ = update_or_create_env(
        example_path=frontend_env_example,
        target_path=frontend_env,
        defaults=frontend_defaults,
    )

    for k in sorted(frontend_kv.keys()):
        status = mask_secret(frontend_kv[k])
        print(f"  - {k:<26}: {status}")

    print("\nEnvironment setup complete. Never commit .env files to version control.")
    return True


if __name__ == "__main__":
    setup_environment()
