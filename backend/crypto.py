"""Cryptographic helpers for Dharohar application.

Provides symmetric encryption and decryption for sensitive fields (such as UPI IDs)
using Fernet derived from the application AUTH_SECRET.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    """Derive a stable 32-byte Fernet key from AUTH_SECRET."""
    from backend.config import get_settings
    secret_bytes = get_settings().AUTH_SECRET.encode("utf-8")
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(secret_bytes).digest())
    return Fernet(derived_key)


def encrypt_sensitive(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a string at rest; returns None if input is None."""
    if plaintext is None or plaintext == "":
        return plaintext
    cipher = _get_fernet()
    return cipher.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_sensitive(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt a ciphertext string; returns original or empty string on failure."""
    if ciphertext is None or ciphertext == "":
        return ciphertext
    try:
        cipher = _get_fernet()
        return cipher.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        # Fallback if text was stored unencrypted or cannot be decrypted
        return ciphertext


def mask_upi_id(upi_id: Optional[str]) -> str:
    """Mask UPI ID for privacy and security display (e.g. 'ra****@okhdfcbank')."""
    if not upi_id:
        return ""
    if "@" in upi_id:
        username, bank = upi_id.split("@", 1)
        if len(username) <= 2:
            masked_user = username[0] + "*"
        else:
            masked_user = username[:2] + "*" * (len(username) - 2)
        return f"{masked_user}@{bank}"
    if len(upi_id) <= 4:
        return upi_id
    return upi_id[:2] + "*" * (len(upi_id) - 4) + upi_id[-2:]
