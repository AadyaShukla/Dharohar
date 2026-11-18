"""Secret scanning utility for Dharohar repository.

Scans tracked and staged files for common secret and credential patterns:
- Razorpay live and test keys (rzp_live_*, rzp_test_*)
- PEM private key headers (BEGIN PRIVATE KEY)
- Google API keys (AIza*)
- Anthropic API keys (sk-ant-*)
- OpenAI API keys (sk-*)
- Hardcoded secrets and tokens in source code

Redacts all matched secret values in output (showing at most the last 4 characters).
Exits with code 1 if any potential secret is found, or 0 if clean.
"""

from __future__ import annotations

import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Dict, List, Optional, Set, Tuple

# Patterns to scan for
SECRET_PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("Razorpay Live API Key", re.compile(r"rzp_live_[a-zA-Z0-9]{14,}")),
    ("Razorpay Test API Key", re.compile(r"rzp_test_[a-zA-Z0-9]{14,}")),
    ("Private Key Header", re.compile(r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----")),
    ("Google API Key", re.compile(r"AIza[0-9A-Za-z\-_]{35}")),
    ("Anthropic API Key", re.compile(r"sk-ant-[a-zA-Z0-9\-_]{20,}")),
    ("OpenAI API Key", re.compile(r"sk-[a-zA-Z0-9\-_]{20,}")),
    (
        "Hardcoded High-Entropy Secret",
        re.compile(
            r"""(?i)(?:api_key|secret_key|auth_secret|private_key|webhook_secret)\s*[:=]\s*['"]([a-zA-Z0-9_\-+=/]{32,})['"]"""
        ),
    ),
]

# Patterns or substrings to whitelist (e.g. simulated mock tokens in tests)
WHITELIST_SUBSTRINGS = [
    "dharohar-simulated-auth-secret-key-32b",
    "token_urlsafe",
    "generate_key",
    "your_secret_here",
    "example",
    "REDACTED",
]

# File extensions to ignore (binaries, images, locks)
IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
    ".db", ".sqlite", ".sqlite3",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pyc", ".pyo", ".zip", ".tar", ".gz",
}

# Directories to skip
IGNORE_DIRS = {
    ".git", "node_modules", "venv", ".venv", "__pycache__",
    "dist", ".pytest_cache", "uploads",
}


def redact_finding(val: str) -> str:
    """Mask secret value showing at most the last 4 characters."""
    v = val.strip()
    if len(v) <= 4:
        return f"[REDACTED ...{v}]"
    return f"[REDACTED ...{v[-4:]}]"


def is_binary_or_ignored(file_path: Path) -> bool:
    """Check if file should be skipped based on path or extension."""
    if file_path.suffix.lower() in IGNORE_EXTENSIONS:
        return True

    for part in file_path.parts:
        if part in IGNORE_DIRS:
            return True

    # Skip gitignored credentials and local env files
    if "firebase-credentials" in file_path.name.lower():
        return True
    if file_path.name.startswith(".env") and not file_path.name.endswith(".example"):
        return True

    # Check for null bytes in small sample
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return True
    except Exception:
        return True

    return False


def get_git_files(project_root: Path) -> Set[Path]:
    """Retrieve tracked and staged files using git commands."""
    files: Set[Path] = set()

    try:
        # Tracked files
        proc = subprocess.run(
            ["git", "ls-files"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                if line.strip():
                    p = project_root / line.strip()
                    if p.exists() and not is_binary_or_ignored(p):
                        files.add(p)

        # Staged files
        proc_staged = subprocess.run(
            ["git", "diff", "--name-only", "--cached"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            check=False,
        )
        if proc_staged.returncode == 0:
            for line in proc_staged.stdout.splitlines():
                if line.strip():
                    p = project_root / line.strip()
                    if p.exists() and not is_binary_or_ignored(p):
                        files.add(p)
    except Exception:
        pass

    return files


def get_workspace_files(project_root: Path) -> Set[Path]:
    """Fallback: scan workspace files when git has no tracked files yet."""
    files: Set[Path] = set()
    for root, dirs, filenames in os.walk(project_root):
        # Exclude ignored directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in filenames:
            p = Path(root) / f
            # Skip ignored files and secret files explicitly covered by gitignore
            if (
                not is_binary_or_ignored(p)
                and not p.name.startswith(".env")
                and not p.name.endswith(".db")
            ):
                files.add(p)
    return files


def scan_file(file_path: Path) -> List[Dict[str, str]]:
    """Scan a single file for exposed secret patterns."""
    findings: List[Dict[str, str]] = []
    if not file_path.exists() or is_binary_or_ignored(file_path):
        return findings

    try:
        lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return findings

    for line_num, line in enumerate(lines, start=1):
        # Check whitelist
        if any(w in line for w in WHITELIST_SUBSTRINGS):
            continue

        for rule_name, pattern in SECRET_PATTERNS:
            match = pattern.search(line)
            if match:
                matched_text = match.group(0)
                findings.append({
                    "file": str(file_path),
                    "line": str(line_num),
                    "rule": rule_name,
                    "redacted": redact_finding(matched_text),
                })
                break  # Record one violation per line to avoid noise

    return findings


def scan_files(paths: List[Path]) -> List[Dict[str, str]]:
    """Scan an explicit list of file paths."""
    all_findings: List[Dict[str, str]] = []
    for p in paths:
        all_findings.extend(scan_file(p))
    return all_findings


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent.parent

    # If specific files passed via CLI, scan only those
    if len(sys.argv) > 1:
        target_files = [Path(arg).resolve() for arg in sys.argv[1:]]
    else:
        # Check tracked/staged files in git
        target_files = list(get_git_files(project_root))
        if not target_files:
            # Fallback to workspace files
            target_files = list(get_workspace_files(project_root))

    findings = scan_files(target_files)

    print("================================================================================")
    print("Dharohar Repository Secret Scanner")
    print("================================================================================")
    print(f"Scanned {len(target_files)} file(s).")

    if not findings:
        print("\nPASS: No exposed secrets or sensitive API credentials detected.")
        print("================================================================================")
        sys.exit(0)

    print("\nFAIL: Exposed secrets or credentials detected in repository files!")
    print("-" * 80)
    for f in findings:
        print(f"  [X] {f['file']}:{f['line']} -> {f['rule']} {f['redacted']}")
    print("-" * 80)
    print("ACTION REQUIRED: Remove or revoke exposed secrets before committing code.")
    print("================================================================================")
    sys.exit(1)


if __name__ == "__main__":
    main()
