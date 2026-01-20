"""Configuration for the LLM Council."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Import logging utilities
try:
    from .security import log_app_event
except ImportError:
    from backend.security import log_app_event

# Try to load .env from current directory or parent directory
env_path = Path('.env')
if not env_path.exists():
    env_path = Path('..') / '.env'
load_dotenv(env_path, override=True)


# =============================================================================
# ENVIRONMENT VALIDATION
# =============================================================================
def validate_config():
    """Validate required environment variables at startup."""
    required = [
        'OPENROUTER_API_KEY',
        'SUPABASE_URL',
    ]
    has_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    missing = [k for k in required if not os.getenv(k)]
    if not has_service_key:
        missing.append('SUPABASE_SERVICE_ROLE_KEY')
    if missing:
        log_app_event("config_validation", level="ERROR", details={
            "status": "missing_env_vars",
            "missing": missing,
            "message": "Please check your .env file or environment configuration"
        })
        # Don't exit - allow graceful degradation for local dev without all services
        # raise SystemExit(1)


# Run validation at import time
validate_config()


# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# =============================================================================
# REDIS CACHING CONFIGURATION
# =============================================================================
# Redis is used for:
# 1. Response caching - Cache identical LLM queries to save money
# 2. Rate limiting - Per-user/company query limits (replaces in-memory slowapi)
# 3. Session caching - Fast auth token validation
#
# SETUP:
# - Development: docker run -d -p 6379:6379 redis
# - Production: Use managed Redis (Render, Railway, Upstash)
# - Or set REDIS_ENABLED=false to disable caching entirely
#
# The app works without Redis - all cache operations fail gracefully.
# =============================================================================
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_ENABLED = os.getenv("REDIS_ENABLED", "true").lower() == "true"
REDIS_DEFAULT_TTL = int(os.getenv("REDIS_DEFAULT_TTL", "3600"))  # 1 hour default

# LLM response cache TTL (longer since responses are expensive)
REDIS_LLM_CACHE_TTL = int(os.getenv("REDIS_LLM_CACHE_TTL", "1800"))  # 30 minutes

# Mock Configuration - bypasses real OpenRouter API calls for testing
# Set MOCK_LLM=true in .env to enable mock mode (saves money during development)
MOCK_LLM = os.getenv("MOCK_LLM", "false").lower() == "true"

# Mock scenarios for testing edge cases:
# - happy_path: Normal responses from all models (default)
# - one_model_fails: Some models return errors (tests graceful degradation)
# - malformed_ranking: Stage 2 rankings missing proper format (tests parser)
# - empty_ranking: Stage 2 has header but no ranking items
MOCK_LLM_SCENARIO = os.getenv("MOCK_LLM_SCENARIO", "happy_path").lower()

# Mock length override - allows testing different response lengths without
# changing LLM Hub production settings. When None, mock uses actual request params.
# Valid values: None (use LLM Hub settings), 512, 1024, 1536, 2048, 4096, 8192
# This can be toggled at runtime via the /settings/mock-length-override endpoint
MOCK_LLM_LENGTH_OVERRIDE: int | None = None
_raw_override = os.getenv("MOCK_LLM_LENGTH_OVERRIDE", "").strip()
if _raw_override and _raw_override.lower() != "none":
    try:
        MOCK_LLM_LENGTH_OVERRIDE = int(_raw_override)
    except ValueError:
        log_app_event("config_validation", level="ERROR", details={
            "status": "invalid_value",
            "variable": "MOCK_LLM_LENGTH_OVERRIDE",
            "value": _raw_override
        })

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
ENABLE_PROMPT_CACHING = os.getenv("ENABLE_PROMPT_CACHING", "true").lower() == "true"

# Models that support cache_control via OpenRouter
# Anthropic: explicit cache_control required (max 4 breakpoints)
# OpenAI: supports caching via OpenRouter
# DeepSeek: supports caching via OpenRouter
# NOTE: Gemini models removed - they have implicit caching via OpenRouter and
# explicit cache_control with multipart format causes issues (hallucinations,
# weird outputs like "REDACTED", mid-stream stops). Let Gemini use implicit caching.
# See: https://github.com/sst/opencode/issues/4912
CACHE_SUPPORTED_MODELS = [
    # Anthropic models (use base names for substring matching)
    "anthropic/claude-opus-4",      # Matches claude-opus-4.5
    "anthropic/claude-sonnet-4",    # Matches claude-sonnet-4
    "anthropic/claude-3-5-sonnet",  # Matches claude-3-5-sonnet-20241022
    "anthropic/claude-3-5-haiku",   # Matches claude-3-5-haiku-20241022
    # OpenAI models
    "openai/gpt-5",                 # Matches gpt-5.1
    "openai/gpt-4o",                # Matches gpt-4o and gpt-4o-mini
    # DeepSeek models
    "deepseek/deepseek-chat",       # Matches deepseek-chat and deepseek-chat-v3-0324
]

# =============================================================================
# MODEL CONFIGURATION
# =============================================================================
# Models are now managed in the database (model_registry table).
# These imports provide backwards compatibility - they use hardcoded fallbacks
# at module load time, but async code should use model_registry.get_models()
# to get the latest from the database.
#
# To change models: Update the model_registry table in Supabase
# =============================================================================

# =============================================================================
# MINIMUM VIABLE COUNCIL CONFIGURATION
# =============================================================================
# Defines the minimum number of successful model responses required for each stage.
# If fewer models respond successfully, the stage will fail with an error.
# This prevents degraded councils from producing low-quality results.
#
# Set MIN_STAGE1_RESPONSES=0 to disable this check (not recommended).
# =============================================================================
MIN_STAGE1_RESPONSES = int(os.getenv("MIN_STAGE1_RESPONSES", "3"))  # Need 3 of 5 models
MIN_STAGE2_RANKINGS = int(os.getenv("MIN_STAGE2_RANKINGS", "2"))    # Need 2 of 6 rankers

# =============================================================================
# AI SECURITY CONFIGURATION
# =============================================================================
# Per-query token limits to prevent DoS via expensive queries
# Queries exceeding this will be rejected before being sent to models
MAX_QUERY_CHARS = int(os.getenv("MAX_QUERY_CHARS", "50000"))  # ~12.5K tokens
MAX_QUERY_TOKENS_ESTIMATE = MAX_QUERY_CHARS // 4  # Rough estimate

# Per-stage timeouts (seconds) - prevents hanging requests
STAGE1_TIMEOUT = int(os.getenv("STAGE1_TIMEOUT", "120"))  # 120s absolute max for Stage 1
STAGE2_TIMEOUT = int(os.getenv("STAGE2_TIMEOUT", "90"))   # 90s for 3 ranking models
STAGE3_TIMEOUT = int(os.getenv("STAGE3_TIMEOUT", "120"))  # 120s for chairman synthesis

# Per-model timeout - individual models that hang get marked as error
# This catches truly stuck models without cancelling healthy ones
# NOTE: 120s gives slower models like GPT-5.1 (with adaptive reasoning) sufficient time
PER_MODEL_TIMEOUT = int(os.getenv("PER_MODEL_TIMEOUT", "120"))  # 120s per individual model

# Require access_token for RLS-protected queries (recommended: true in production)
# When false, falls back to service client (bypasses RLS) - only for backwards compat
REQUIRE_ACCESS_TOKEN = os.getenv("REQUIRE_ACCESS_TOKEN", "false").lower() == "true"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"

# Stripe Configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# =============================================================================
# QDRANT VECTOR DATABASE CONFIGURATION
# =============================================================================
# Qdrant is used for:
# 1. Semantic search - Find similar conversations/knowledge entries
# 2. RAG retrieval - Context retrieval for council queries
# 3. Knowledge embeddings - Store decision embeddings for lookup
#
# SETUP:
# - Development: docker run -d -p 6333:6333 qdrant/qdrant
# - Production: Use Qdrant Cloud (https://cloud.qdrant.io)
#
# The app works without Qdrant - vector search operations fail gracefully.
# =============================================================================
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")  # None for local, required for cloud
QDRANT_ENABLED = os.getenv("QDRANT_ENABLED", "true").lower() == "true"

# Collection names for different data types
QDRANT_COLLECTION_CONVERSATIONS = "conversations"
QDRANT_COLLECTION_KNOWLEDGE = "knowledge_entries"
QDRANT_COLLECTION_DOCUMENTS = "org_documents"

# Embedding configuration
# Using OpenAI's text-embedding-3-small via OpenRouter (1536 dimensions)
EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

# Subscription tiers configuration
# Pricing is configurable via environment variables (values in cents)
# These will be created in Stripe if they don't exist
#
# Environment variables:
#   SUBSCRIPTION_FREE_QUERIES=5
#   SUBSCRIPTION_PRO_PRICE=2900  (in cents, $29.00)
#   SUBSCRIPTION_PRO_QUERIES=100
#   SUBSCRIPTION_ENTERPRISE_PRICE=9900  (in cents, $99.00)
#   SUBSCRIPTION_ENTERPRISE_QUERIES=-1  (-1 = unlimited)
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "queries_per_month": int(os.environ.get("SUBSCRIPTION_FREE_QUERIES", "5")),
        "features": ["Basic council queries", "Standard response time"],
    },
    "pro": {
        "name": "Pro",
        "price_monthly": int(os.environ.get("SUBSCRIPTION_PRO_PRICE", "2900")),
        "queries_per_month": int(os.environ.get("SUBSCRIPTION_PRO_QUERIES", "100")),
        "features": ["100 council queries/month", "Priority response", "Knowledge curator"],
    },
    "enterprise": {
        "name": "Enterprise",
        "price_monthly": int(os.environ.get("SUBSCRIPTION_ENTERPRISE_PRICE", "9900")),
        "queries_per_month": int(os.environ.get("SUBSCRIPTION_ENTERPRISE_QUERIES", "-1")),
        "features": ["Unlimited queries", "Priority support", "Custom departments", "API access"],
    },
}
