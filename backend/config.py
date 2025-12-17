"""Configuration for the LLM Council."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Try to load .env from current directory or parent directory
env_path = Path('.env')
if not env_path.exists():
    env_path = Path('..') / '.env'
load_dotenv(env_path, override=True)

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Mock Configuration - bypasses real OpenRouter API calls for testing
# Set MOCK_LLM=true in .env to enable mock mode (saves money during development)
MOCK_LLM = os.getenv("MOCK_LLM", "false").lower() == "true"

# Mock scenarios for testing edge cases:
# - happy_path: Normal responses from all models (default)
# - one_model_fails: Some models return errors (tests graceful degradation)
# - malformed_ranking: Stage 2 rankings missing proper format (tests parser)
# - empty_ranking: Stage 2 has header but no ranking items
MOCK_LLM_SCENARIO = os.getenv("MOCK_LLM_SCENARIO", "happy_path").lower()

# =============================================================================
# PROMPT CACHING CONFIGURATION (KILL SWITCH)
# =============================================================================
# Set ENABLE_PROMPT_CACHING=false in .env to disable caching and revert to
# standard message format. This is your safety switch if caching causes issues.
#
# When enabled:
# - System prompts are sent with cache_control for Anthropic/Gemini
# - Can reduce costs by 50-75% on repeated context
# - 5-minute TTL on cached content
#
# When disabled:
# - Standard message format (no cache_control)
# - Identical behavior to before this feature was added
# =============================================================================
ENABLE_PROMPT_CACHING = os.getenv("ENABLE_PROMPT_CACHING", "false").lower() == "true"

# Models that support cache_control via OpenRouter
# Anthropic: explicit cache_control required (max 4 breakpoints)
# Gemini: implicit + explicit supported
# Others: may have automatic caching, no explicit support needed
CACHE_SUPPORTED_MODELS = [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-3-pro-preview",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash",
]

# Council members - list of OpenRouter model identifiers
# Note: Gemini placed first to avoid potential issues with concurrent streams
COUNCIL_MODELS = [
    "google/gemini-3-pro-preview",
    "openai/gpt-5.1",
    "anthropic/claude-opus-4.5",
    "x-ai/grok-4",
    "deepseek/deepseek-chat-v3-0324",
]

# Chairman models - synthesizes final response (with fallbacks)
# Will try each in order until one succeeds
CHAIRMAN_MODELS = [
    "anthropic/claude-opus-4.5",     # Primary
    "google/gemini-3-pro-preview",   # Fallback 1
    "openai/gpt-5.1",                # Fallback 2
]

# For backwards compatibility
CHAIRMAN_MODEL = CHAIRMAN_MODELS[0]

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"

# Stripe Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Subscription tiers configuration (placeholder pricing - update as needed)
# These will be created in Stripe if they don't exist
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "queries_per_month": 5,
        "features": ["Basic council queries", "Standard response time"],
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 2900,  # $29.00 in cents
        "queries_per_month": 100,
        "features": ["100 council queries/month", "Priority response", "Knowledge curator"],
    },
    "enterprise": {
        "name": "Enterprise",
        "price_monthly": 9900,  # $99.00 in cents
        "queries_per_month": -1,  # Unlimited
        "features": ["Unlimited queries", "Priority support", "Custom departments", "API access"],
    },
}
