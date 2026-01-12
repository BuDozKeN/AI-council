"""
Trial Service

Manages free trial runs for the onboarding flow:
- Check if user has trial available
- Mark trial as used
- Get API key for user (master key for trial, user key otherwise)
"""

import os
from typing import Optional
from datetime import datetime, timezone

try:
    from ..database import get_supabase_service
    from ..security import log_app_event
except ImportError:
    from backend.database import get_supabase_service
    from backend.security import log_app_event


class TrialService:
    """
    Service for managing user trial runs.

    Trial System:
    - Each user gets ONE free council run (trial)
    - Trial runs use the master OpenRouter API key
    - After trial, user must add their own API key or upgrade
    """

    TRIAL_TYPE = "onboarding_council"

    async def check_trial_available(self, user_id: str) -> bool:
        """
        Check if user has a trial run available.

        Returns True if no trial has been used, False otherwise.
        """
        try:
            client = get_supabase_service()
            result = client.table("user_trials") \
                .select("id") \
                .eq("user_id", user_id) \
                .eq("trial_type", self.TRIAL_TYPE) \
                .execute()

            # Trial is available if no record exists
            return len(result.data) == 0

        except Exception as e:
            log_app_event(
                "TRIAL_CHECK_FAILED",
                level="WARNING",
                error=str(e),
                user_id=user_id[:8] + "..." if user_id else None
            )
            # Fail open - allow trial if check fails
            return True

    async def check_has_api_key(self, user_id: str) -> bool:
        """
        Check if user has their own OpenRouter API key configured.
        """
        try:
            client = get_supabase_service()
            result = client.table("user_api_keys") \
                .select("id") \
                .eq("user_id", user_id) \
                .eq("is_active", True) \
                .execute()

            return len(result.data) > 0

        except Exception as e:
            log_app_event(
                "API_KEY_CHECK_FAILED",
                level="WARNING",
                error=str(e)
            )
            return False

    async def get_trial_info(self, user_id: str) -> Optional[dict]:
        """
        Get trial information for a user.

        Returns dict with trial details or None if no trial used.
        """
        try:
            client = get_supabase_service()
            result = client.table("user_trials") \
                .select("*") \
                .eq("user_id", user_id) \
                .eq("trial_type", self.TRIAL_TYPE) \
                .execute()

            if result.data and len(result.data) > 0:
                trial = result.data[0]
                return {
                    "id": trial.get("id"),
                    "used_at": trial.get("used_at"),
                    "ip_address": trial.get("ip_address"),
                }
            return None

        except Exception as e:
            log_app_event(
                "TRIAL_INFO_FETCH_FAILED",
                level="WARNING",
                error=str(e)
            )
            return None

    async def use_trial(self, user_id: str, ip_address: Optional[str] = None) -> bool:
        """
        Mark the user's trial as used.

        Returns True if successful, False otherwise.
        Idempotent - safe to call multiple times.
        """
        try:
            client = get_supabase_service()

            # Check if already used (idempotent)
            existing = client.table("user_trials") \
                .select("id") \
                .eq("user_id", user_id) \
                .eq("trial_type", self.TRIAL_TYPE) \
                .execute()

            if existing.data and len(existing.data) > 0:
                # Already used - idempotent success
                return True

            # Insert trial record
            client.table("user_trials").insert({
                "user_id": user_id,
                "trial_type": self.TRIAL_TYPE,
                "used_at": datetime.now(timezone.utc).isoformat(),
                "ip_address": ip_address,
            }).execute()

            log_app_event(
                "TRIAL_MARKED_USED",
                level="INFO",
                user_id=user_id[:8] + "..." if user_id else None
            )

            return True

        except Exception as e:
            log_app_event(
                "TRIAL_USE_FAILED",
                level="ERROR",
                error=str(e),
                user_id=user_id[:8] + "..." if user_id else None
            )
            return False

    async def get_api_key_for_user(self, user_id: str) -> tuple[Optional[str], bool]:
        """
        Get the API key to use for this user's council run.

        Returns:
            (api_key, is_trial):
            - Master key + is_trial=True if trial available
            - User's key + is_trial=False if they have their own key
            - (None, False) if no trial and no key
        """
        # Check if trial is available
        if await self.check_trial_available(user_id):
            master_key = os.getenv("OPENROUTER_API_KEY")
            if master_key:
                return master_key, True

        # Check for user's own API key
        try:
            client = get_supabase_service()
            result = client.table("user_api_keys") \
                .select("encrypted_key") \
                .eq("user_id", user_id) \
                .eq("is_active", True) \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if result.data and len(result.data) > 0:
                # TODO: Decrypt the key if using encryption
                # For now, assume key is stored encrypted and needs decryption
                encrypted_key = result.data[0].get("encrypted_key")
                if encrypted_key:
                    # Decrypt key (implement based on your encryption scheme)
                    decrypted_key = await self._decrypt_api_key(encrypted_key)
                    return decrypted_key, False

        except Exception as e:
            log_app_event(
                "USER_API_KEY_FETCH_FAILED",
                level="WARNING",
                error=str(e)
            )

        return None, False

    async def _decrypt_api_key(self, encrypted_key: str) -> str:
        """
        Decrypt a user's API key.

        TODO: Implement actual decryption based on your security scheme.
        Currently returns the key as-is (assuming it's not actually encrypted yet).
        """
        # If using Supabase Vault or similar, implement decryption here
        # For now, return as-is (development mode)
        return encrypted_key

    async def can_run_council(self, user_id: str) -> tuple[bool, str]:
        """
        Check if user can run a council session.

        Returns:
            (can_run, reason):
            - (True, "trial") if trial available
            - (True, "api_key") if user has API key
            - (False, "no_credits") if neither
        """
        if await self.check_trial_available(user_id):
            return True, "trial"

        if await self.check_has_api_key(user_id):
            return True, "api_key"

        return False, "no_credits"

    async def reset_trial(self, user_id: str) -> bool:
        """
        Reset the user's trial status (DEV ONLY).

        Deletes the trial record so the user can test onboarding again.
        Returns True if a record was deleted, False if no record existed.
        """
        try:
            client = get_supabase_service()

            # Delete trial record
            result = client.table("user_trials") \
                .delete() \
                .eq("user_id", user_id) \
                .eq("trial_type", self.TRIAL_TYPE) \
                .execute()

            # Check if anything was deleted
            deleted = bool(result.data and len(result.data) > 0)

            if deleted:
                log_app_event(
                    "TRIAL_RESET",
                    level="INFO",
                    user_id=user_id[:8] + "..." if user_id else None
                )

            return deleted

        except Exception as e:
            log_app_event(
                "TRIAL_RESET_FAILED",
                level="ERROR",
                error=str(e),
                user_id=user_id[:8] + "..." if user_id else None
            )
            return False
