"""Encryption utilities for secure storage of user API keys.

SECURITY: Uses per-user derived keys via HKDF to ensure that:
1. Each user's data is encrypted with a unique key
2. Compromise of one user's derived key doesn't affect others
3. The master secret alone cannot decrypt any user data without their user_id
4. Dynamic salt from environment adds additional entropy
"""

import os
import base64
from typing import Optional

# Cache for per-user ciphers (keyed by user_id)
_cipher_cache = {}

# Master key for key derivation
_master_key = None

# HKDF salt - configurable via environment for additional security
_hkdf_salt = None


def _get_master_key() -> bytes:
    """Get the master encryption key from environment."""
    global _master_key
    if _master_key is None:
        key = os.getenv("USER_KEY_ENCRYPTION_SECRET")
        if not key:
            raise ValueError(
                "USER_KEY_ENCRYPTION_SECRET environment variable is not set. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        # Decode the Fernet key to get raw bytes
        _master_key = base64.urlsafe_b64decode(key.encode())
    return _master_key


def _get_hkdf_salt() -> bytes:
    """
    Get HKDF salt from environment or use default.

    SECURITY: A configurable salt adds entropy and allows rotation without
    changing the master key. The default is used for backwards compatibility.

    To generate a new salt:
        python -c "import secrets; print(secrets.token_hex(32))"
    """
    global _hkdf_salt
    if _hkdf_salt is None:
        salt_hex = os.getenv("HKDF_SALT")
        if salt_hex:
            # Use environment-provided salt (hex-encoded)
            _hkdf_salt = bytes.fromhex(salt_hex)
        else:
            # Default salt for backwards compatibility
            # SECURITY NOTE: Set HKDF_SALT in production for better security
            _hkdf_salt = b"ai_council_user_keys"
    return _hkdf_salt


def _derive_user_key(user_id: str) -> bytes:
    """
    Derive a unique encryption key for a specific user using HKDF.

    SECURITY: This ensures each user's data is encrypted with a unique key.
    Even if an attacker obtains the master key, they need the user_id to derive
    the actual encryption key for that user's data.

    Args:
        user_id: The user's unique identifier (UUID)

    Returns:
        32-byte derived key suitable for Fernet
    """
    try:
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.hkdf import HKDF
        from cryptography.hazmat.backends import default_backend
    except ImportError:
        raise ImportError(
            "cryptography package is required for BYOK encryption. "
            "Install with: pip install cryptography"
        )

    master_key = _get_master_key()
    salt = _get_hkdf_salt()

    # Use HKDF to derive a user-specific key
    # Info contains "user_api_key" to bind the key to this specific use case
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,  # Fernet requires 32-byte key
        salt=salt,  # Configurable via HKDF_SALT env var
        info=f"user_api_key:{user_id}".encode(),
        backend=default_backend()
    )

    derived_key = hkdf.derive(master_key)
    # Fernet requires URL-safe base64 encoded key
    return base64.urlsafe_b64encode(derived_key)


def get_cipher_for_user(user_id: str):
    """Get or create the Fernet cipher for a specific user."""
    if not user_id:
        raise ValueError("user_id is required for encryption operations")

    if user_id not in _cipher_cache:
        try:
            from cryptography.fernet import Fernet
        except ImportError:
            raise ImportError(
                "cryptography package is required for BYOK encryption. "
                "Install with: pip install cryptography"
            )

        derived_key = _derive_user_key(user_id)
        _cipher_cache[user_id] = Fernet(derived_key)

    return _cipher_cache[user_id]


# Legacy function for backward compatibility (uses a default user context)
def get_cipher():
    """
    DEPRECATED: Use get_cipher_for_user(user_id) instead.

    This function exists for backward compatibility during migration.
    It uses a legacy derivation path.
    """
    return get_cipher_for_user("_legacy_global_")


def encrypt_api_key(raw_key: str, user_id: Optional[str] = None) -> str:
    """
    Encrypt an API key for secure storage.

    SECURITY: Uses per-user derived keys when user_id is provided.

    Args:
        raw_key: The plaintext OpenRouter API key
        user_id: The user's ID for per-user key derivation (recommended)

    Returns:
        Base64-encoded encrypted key string
    """
    if not raw_key:
        raise ValueError("API key cannot be empty")

    if user_id:
        cipher = get_cipher_for_user(user_id)
    else:
        # Fallback to legacy behavior (not recommended)
        cipher = get_cipher()

    encrypted = cipher.encrypt(raw_key.encode())
    return encrypted.decode()


def decrypt_api_key(encrypted_key: str, user_id: Optional[str] = None) -> str:
    """
    Decrypt an API key for use.

    SECURITY: Uses per-user derived keys when user_id is provided.

    Args:
        encrypted_key: The encrypted key from storage
        user_id: The user's ID for per-user key derivation (recommended)

    Returns:
        The plaintext API key

    Raises:
        ValueError: If the encrypted key is empty or malformed
        DecryptionError: If the key cannot be decrypted (wrong cipher, corrupted data)
    """
    if not encrypted_key:
        raise ValueError("Encrypted key cannot be empty")

    try:
        from cryptography.fernet import InvalidToken
    except ImportError:
        InvalidToken = Exception

    if user_id:
        cipher = get_cipher_for_user(user_id)
    else:
        # Fallback to legacy behavior (not recommended)
        cipher = get_cipher()

    try:
        decrypted = cipher.decrypt(encrypted_key.encode())
        return decrypted.decode()
    except InvalidToken as e:
        # Fernet raises InvalidToken for bad padding, wrong key, or corrupted data
        raise DecryptionError(
            "Failed to decrypt API key: data is corrupted or was encrypted with a different key"
        ) from e
    except Exception as e:
        # Catch base64 decoding errors ("Incorrect padding") and other issues
        error_msg = str(e)
        if "padding" in error_msg.lower() or "base64" in error_msg.lower():
            raise DecryptionError(
                "Failed to decrypt API key: invalid encrypted data format"
            ) from e
        raise DecryptionError(f"Failed to decrypt API key: {error_msg}") from e


class DecryptionError(Exception):
    """Raised when decryption fails due to corrupted data or wrong key."""
    pass


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
