"""Encryption utilities for secure storage of user API keys."""

import os
from typing import Optional

# Lazy-loaded cipher to avoid import errors if cryptography not installed
_cipher = None


def get_cipher():
    """Get or create the Fernet cipher for encryption/decryption."""
    global _cipher
    if _cipher is None:
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            raise ImportError(
                "cryptography package is required for BYOK encryption. "
                "Install with: pip install cryptography"
            )

        key = os.getenv("USER_KEY_ENCRYPTION_SECRET")
        if not key:
            raise ValueError(
                "USER_KEY_ENCRYPTION_SECRET environment variable is not set. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )

        # Validate the key format
        try:
            _cipher = Fernet(key.encode())
        except Exception as e:
            raise ValueError(f"Invalid USER_KEY_ENCRYPTION_SECRET: {e}")

    return _cipher


def encrypt_api_key(raw_key: str) -> str:
    """
    Encrypt an API key for secure storage.

    Args:
        raw_key: The plaintext OpenRouter API key

    Returns:
        Base64-encoded encrypted key string
    """
    if not raw_key:
        raise ValueError("API key cannot be empty")

    cipher = get_cipher()
    encrypted = cipher.encrypt(raw_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """
    Decrypt an API key for use.

    Args:
        encrypted_key: The encrypted key from storage

    Returns:
        The plaintext API key
    """
    if not encrypted_key:
        raise ValueError("Encrypted key cannot be empty")

    cipher = get_cipher()
    decrypted = cipher.decrypt(encrypted_key.encode())
    return decrypted.decode()


def get_key_suffix(raw_key: str) -> str:
    """
    Get the last 4 characters of an API key for display.

    Args:
        raw_key: The plaintext API key

    Returns:
        Last 4 characters (e.g., "1234" from "sk-or-v1-...1234")
    """
    if not raw_key or len(raw_key) < 4:
        return "****"
    return raw_key[-4:]


def mask_api_key(raw_key: str) -> str:
    """
    Create a masked display version of an API key.

    Args:
        raw_key: The plaintext API key

    Returns:
        Masked key (e.g., "sk-or-v1-••••••••1234")
    """
    if not raw_key:
        return "••••••••"

    # OpenRouter keys typically start with "sk-or-v1-"
    prefix = ""
    if raw_key.startswith("sk-or-"):
        # Extract prefix like "sk-or-v1-"
        parts = raw_key.split("-")
        if len(parts) >= 3:
            prefix = "-".join(parts[:3]) + "-"

    suffix = get_key_suffix(raw_key)
    return f"{prefix}••••••••{suffix}"
