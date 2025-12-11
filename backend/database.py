"""Supabase database connection."""

import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
from typing import Optional

# Load .env from current dir or parent dir
env_path = Path(__file__).resolve().parent.parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(env_path)

# Supabase configuration (support both SUPABASE_KEY and SUPABASE_ANON_KEY)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Optional: for admin operations

# Supabase client (lazy initialization)
_supabase_client: Client = None
_supabase_service_client: Client = None


def get_supabase() -> Client:
    """Get or create the Supabase client (anon key - subject to RLS)."""
    global _supabase_client

    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
                "Add them to your .env file."
            )
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)

    return _supabase_client


def get_supabase_service() -> Optional[Client]:
    """
    Get or create the Supabase service client (bypasses RLS).
    Used for admin operations like webhooks.
    Returns None if service key is not configured.
    """
    global _supabase_service_client

    if _supabase_service_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return None
        _supabase_service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    return _supabase_service_client


def get_supabase_with_auth(access_token: str) -> Client:
    """
    Create a Supabase client authenticated with a user's JWT token.
    This client will respect RLS policies using the user's identity.

    Args:
        access_token: The user's JWT access token from Supabase Auth

    Returns:
        Authenticated Supabase client
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in environment variables. "
            "Add them to your .env file."
        )

    # Create a new client with the user's access token
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Set the auth header to use the user's token
    # This makes auth.uid() return the user's ID in RLS policies
    client.postgrest.auth(access_token)

    # Also set auth for storage operations
    # The storage client needs the Authorization header set
    client.storage._client.headers["Authorization"] = f"Bearer {access_token}"

    return client


def is_supabase_configured() -> bool:
    """Check if Supabase is configured."""
    return bool(SUPABASE_URL and SUPABASE_KEY)
