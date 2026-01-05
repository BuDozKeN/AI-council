# LLM Configuration Layer - Implementation Plan

## Status: ALL PHASES COMPLETE ✅

### Phase 1: Database + Backend ✅
- ✅ `supabase/migrations/20260103000000_department_llm_config.sql` - NEW
- ✅ `backend/llm_config.py` - NEW (config resolution helpers)
- ✅ `backend/openrouter.py` - UPDATED (temperature, max_tokens, top_p params)
- ✅ `backend/council.py` - UPDATED (uses llm_config per stage)
- ✅ `backend/routers/conversations.py` - UPDATED (modifier param in API)

### Phase 2: Preset Selection UI ✅
- ✅ `frontend/src/types/business.ts` - UPDATED (LLMPresetId, LLM_PRESETS)
- ✅ `frontend/src/components/ui/LLMPresetSelect.tsx` - NEW (Radix Select + Tooltip)
- ✅ `frontend/src/components/ui/LLMPresetSelect.css` - NEW (design tokens)
- ✅ `frontend/src/components/mycompany/modals/ViewDepartmentModal.tsx` - UPDATED (preset selector)
- ✅ `backend/routers/company/utils.py` - UPDATED (Literal type validation)
- ✅ `frontend/src/api.ts` - UPDATED (LLMPresetId type)

### Phase 3: Conversation Modifiers (Chips) ✅
- ✅ `frontend/src/types/business.ts` - UPDATED (ConversationModifier type, CONVERSATION_MODIFIERS)
- ✅ `frontend/src/components/chat/ConversationModifierChips.tsx` - NEW (toggle chips)
- ✅ `frontend/src/components/chat/ConversationModifierChips.css` - NEW (chip styles)
- ✅ `frontend/src/components/chat/ChatInput.tsx` - UPDATED (modifier props)
- ✅ `frontend/src/components/ChatInterface.tsx` - UPDATED (modifier props)
- ✅ `frontend/src/App.tsx` - UPDATED (modifier state, API call)
- ✅ `frontend/src/api.ts` - UPDATED (modifier in SendMessageStreamOptions)

### Phase 4: Admin LLM Hub ✅
- ✅ `backend/routers/company/llm_ops.py` - UPDATED (preset/model CRUD endpoints)
- ✅ `frontend/src/types/business.ts` - UPDATED (LLMPresetFull, ModelRegistryEntry, etc.)
- ✅ `frontend/src/api.ts` - UPDATED (getLLMPresets, updateLLMPreset, getModelRegistry, etc.)
- ✅ `frontend/src/components/mycompany/tabs/LLMHubTab.tsx` - NEW (admin UI)
- ✅ `frontend/src/components/mycompany/styles/tabs/llm-hub.css` - NEW (styles)
- ✅ `frontend/src/components/mycompany/MyCompanyTabs.tsx` - UPDATED (added LLM Hub tab)
- ✅ `frontend/src/components/mycompany/hooks/useCompanyData.ts` - UPDATED (llm-hub tab type)
- ✅ `frontend/src/components/MyCompany.tsx` - UPDATED (renders LLMHubTab)

**Implementation complete!** Platform owners can now configure LLM presets and model registry without code changes.

---

## Overview

This plan implements the council's recommendations for an LLM configuration layer with **Zero Friction + progressive disclosure**. The infrastructure is 90% ready in the main AxCouncil project - we need to add department-specific LLM parameters.

---

## Current State (AxCouncil/AI-council)

### What Already Exists
| Component | Status | Location |
|-----------|--------|----------|
| Supabase database | ✅ Ready | `supabase/migrations/` |
| Auth system | ✅ Ready | `backend/auth.py` |
| Companies/Departments/Roles | ✅ Ready | Schema in place |
| model_registry table | ✅ Ready | Per-role model config |
| session_usage tracking | ✅ Ready | Token/cost per session |
| rate_limits per company | ✅ Ready | Budget controls |
| Conversation privacy (RLS) | ✅ Ready | Per-user isolation |
| OpenRouter client | ✅ Ready | `backend/openrouter.py` |
| 3-stage council orchestration | ✅ Ready | `backend/council.py` |

### What's Missing
| Gap | Impact |
|-----|--------|
| **No temperature parameter** | All departments use OpenRouter defaults |
| **No department-specific LLM config** | Legal and Marketing behave identically |
| **No per-stage parameter overrides** | Can't have conservative Stage 2 with creative Stage 1 |
| **No user preferences table** | Users can't save personal style preferences |

---

## Implementation Phases

### Phase 1: Department LLM Profiles (Database + Backend)
**Goal**: Add temperature/max_tokens configuration per department

#### 1.1 New Migration: Department LLM Config

**File**: `supabase/migrations/YYYYMMDD_department_llm_config.sql`

```sql
-- =============================================
-- DEPARTMENT LLM CONFIGURATION
-- =============================================
-- Adds LLM parameter configuration per department for council behavior tuning.
-- Enables Legal to be conservative while Marketing is creative.

-- Add llm_config column to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS llm_config JSONB DEFAULT '{}'::jsonb;

-- Structure of llm_config:
-- {
--   "stage1": { "temperature": 0.7, "max_tokens": 1536 },
--   "stage2": { "temperature": 0.3, "max_tokens": 512 },
--   "stage3": { "temperature": 0.5, "max_tokens": 2048 }
-- }

-- Add preset column for quick selection (optional - maps to predefined configs)
ALTER TABLE departments ADD COLUMN IF NOT EXISTS llm_preset TEXT DEFAULT 'balanced';

-- Presets: 'conservative', 'balanced', 'creative', 'custom'
-- If preset != 'custom', llm_config is auto-populated from preset defaults

-- Create system presets table (global defaults)
CREATE TABLE IF NOT EXISTS llm_presets (
    id TEXT PRIMARY KEY,  -- 'conservative', 'balanced', 'creative'
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default presets
INSERT INTO llm_presets (id, name, description, config) VALUES
('conservative', 'Conservative', 'Low temperature, precise and deterministic. Best for legal, compliance, HR.', '{
    "stage1": { "temperature": 0.2, "max_tokens": 1024 },
    "stage2": { "temperature": 0.15, "max_tokens": 512 },
    "stage3": { "temperature": 0.25, "max_tokens": 2048 }
}'::jsonb),
('balanced', 'Balanced', 'Moderate temperature, good for general business queries.', '{
    "stage1": { "temperature": 0.5, "max_tokens": 1536 },
    "stage2": { "temperature": 0.3, "max_tokens": 512 },
    "stage3": { "temperature": 0.4, "max_tokens": 2048 }
}'::jsonb),
('creative', 'Creative', 'Higher temperature for varied, creative outputs. Best for marketing, content.', '{
    "stage1": { "temperature": 0.8, "max_tokens": 2048 },
    "stage2": { "temperature": 0.5, "max_tokens": 512 },
    "stage3": { "temperature": 0.7, "max_tokens": 2048 }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- RLS for llm_presets (everyone can read global presets)
ALTER TABLE llm_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "llm_presets_read" ON llm_presets
    FOR SELECT USING (is_active = true);

-- Function to get effective LLM config for a department
CREATE OR REPLACE FUNCTION get_department_llm_config(p_department_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_preset TEXT;
    v_custom_config JSONB;
    v_preset_config JSONB;
BEGIN
    -- Get department's preset and custom config
    SELECT llm_preset, llm_config INTO v_preset, v_custom_config
    FROM departments WHERE id = p_department_id;

    IF v_preset IS NULL OR v_preset = 'balanced' THEN
        v_preset := 'balanced';
    END IF;

    -- If custom preset, use custom config
    IF v_preset = 'custom' AND v_custom_config IS NOT NULL AND v_custom_config != '{}'::jsonb THEN
        RETURN v_custom_config;
    END IF;

    -- Otherwise get from presets table
    SELECT config INTO v_preset_config FROM llm_presets WHERE id = v_preset;
    RETURN COALESCE(v_preset_config, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_departments_llm_preset ON departments(llm_preset);
```

#### 1.2 Update OpenRouter Client

**File**: `backend/openrouter.py`

Add temperature and other parameters to API calls:

```python
async def query_model(
    model: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    api_key: Optional[str] = None,
    # NEW: LLM parameters
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    top_p: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """Query a single model with optional LLM parameters."""

    # ... existing code ...

    payload = {
        "model": model,
        "messages": cached_messages,
        "usage": {"include": True},
    }

    # Add optional parameters (only if specified)
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    else:
        payload["max_tokens"] = 4096  # Default
    if top_p is not None:
        payload["top_p"] = top_p

    # ... rest of existing code ...
```

Similarly update `query_model_stream` and `query_models_parallel`.

#### 1.3 Create LLM Config Helper

**File**: `backend/llm_config.py` (new)

```python
"""
LLM Configuration helpers.

Resolves effective LLM config for a department by:
1. Checking department's llm_config (if custom)
2. Falling back to preset config
3. Applying any company-level overrides
4. Applying any conversation-level modifiers
"""

from typing import Dict, Any, Optional
from .database import get_supabase_service

# Hardcoded fallbacks (used if database unavailable)
FALLBACK_CONFIGS = {
    "conservative": {
        "stage1": {"temperature": 0.2, "max_tokens": 1024},
        "stage2": {"temperature": 0.15, "max_tokens": 512},
        "stage3": {"temperature": 0.25, "max_tokens": 2048},
    },
    "balanced": {
        "stage1": {"temperature": 0.5, "max_tokens": 1536},
        "stage2": {"temperature": 0.3, "max_tokens": 512},
        "stage3": {"temperature": 0.4, "max_tokens": 2048},
    },
    "creative": {
        "stage1": {"temperature": 0.8, "max_tokens": 2048},
        "stage2": {"temperature": 0.5, "max_tokens": 512},
        "stage3": {"temperature": 0.7, "max_tokens": 2048},
    },
}


async def get_llm_config(
    department_id: Optional[str] = None,
    stage: str = "stage1",
    conversation_modifier: Optional[str] = None,  # "creative", "cautious", etc.
) -> Dict[str, Any]:
    """
    Get effective LLM configuration for a request.

    Args:
        department_id: Department UUID (if using department-specific config)
        stage: Which stage ("stage1", "stage2", "stage3")
        conversation_modifier: Optional per-conversation modifier

    Returns:
        Dict with temperature, max_tokens, etc.
    """
    config = {"temperature": 0.5, "max_tokens": 1536}  # Default

    if department_id:
        try:
            supabase = get_supabase_service()
            if supabase:
                result = supabase.rpc(
                    "get_department_llm_config",
                    {"p_department_id": department_id}
                ).execute()

                if result.data:
                    dept_config = result.data
                    stage_config = dept_config.get(stage, {})
                    config.update(stage_config)
        except Exception:
            pass  # Use defaults on error

    # Apply conversation modifier (bounded adjustment)
    if conversation_modifier:
        base_temp = config.get("temperature", 0.5)
        if conversation_modifier == "creative":
            config["temperature"] = min(1.0, base_temp + 0.15)
        elif conversation_modifier == "cautious":
            config["temperature"] = max(0.1, base_temp - 0.15)
        elif conversation_modifier == "concise":
            config["max_tokens"] = max(512, config.get("max_tokens", 1536) // 2)

    return config


def get_llm_config_sync(preset: str = "balanced", stage: str = "stage1") -> Dict[str, Any]:
    """Synchronous version using fallbacks only."""
    preset_config = FALLBACK_CONFIGS.get(preset, FALLBACK_CONFIGS["balanced"])
    return preset_config.get(stage, {"temperature": 0.5, "max_tokens": 1536})
```

#### 1.4 Update Council Orchestration

**File**: `backend/council.py`

Pass LLM config to OpenRouter calls:

```python
from .llm_config import get_llm_config

async def stage1_stream_responses(
    user_query: str,
    # ... existing params ...
    department_uuid: Optional[str] = None,
    conversation_modifier: Optional[str] = None,  # NEW
) -> AsyncGenerator[Dict[str, Any], None]:

    # Get LLM config for this department/stage
    llm_config = await get_llm_config(
        department_id=department_uuid,
        stage="stage1",
        conversation_modifier=conversation_modifier
    )

    # ... existing setup code ...

    async def stream_single_model(model: str):
        async for chunk in query_model_stream(
            model,
            messages,
            temperature=llm_config.get("temperature"),
            max_tokens=llm_config.get("max_tokens"),
        ):
            # ... existing streaming logic ...
```

---

### Phase 2: Preset Selection UI
**Goal**: Allow department admins to select behavior presets

#### 2.1 API Endpoint for Preset Management

**File**: `backend/routers/company/departments.py` (or similar)

```python
@router.patch("/{department_id}/llm-config")
async def update_department_llm_config(
    department_id: str,
    preset: str = Body(..., embed=True),  # 'conservative', 'balanced', 'creative'
    user: User = Depends(get_current_user)
):
    """Update department LLM preset. Requires admin role."""
    # Validate user is admin of this department's company
    # Update departments.llm_preset
    # Return updated config
```

#### 2.2 Frontend Settings Component

Add to department settings in the frontend:
- Dropdown with preset options (Conservative, Balanced, Creative)
- Description of what each does
- "Changes affect future conversations only"

---

### Phase 3: Conversation Modifiers (Chips)
**Goal**: Per-conversation tweaks via UI chips

#### 3.1 Add Modifier to Conversation Request

Update the message API to accept optional `modifier`:

```python
class MessageRequest(BaseModel):
    content: str
    business_id: Optional[str] = None
    department_id: Optional[str] = None
    modifier: Optional[str] = None  # "creative", "cautious", "concise"
```

#### 3.2 Frontend Chips

Add chips near the input field:
- "More creative" → modifier="creative"
- "More cautious" → modifier="cautious"
- "More concise" → modifier="concise"

Chips toggle on/off, only one active at a time.

---

### Phase 4: Advanced LLM Hub (Admin Only)
**Goal**: Full control surface for power users

#### 4.1 Custom Config UI

When preset = "custom", show:
- Temperature sliders (0.0-1.0) per stage
- Max tokens dropdown (512 / 1024 / 2048 / 4096)
- Reset to preset button

#### 4.2 Model Selection (Future)

Allow selecting which models participate in each stage:
- Stage 1 expert checkboxes (min 3 required)
- Chairman selector from whitelist
- Cost estimates per configuration

---

## File Changes Summary

### Phase 1 (Immediate)
| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_department_llm_config.sql` | NEW - Add llm_config column + presets |
| `backend/llm_config.py` | NEW - Config resolution helpers |
| `backend/openrouter.py` | UPDATE - Add temperature/max_tokens params |
| `backend/council.py` | UPDATE - Pass LLM config to queries |

### Phase 2 (Settings UI)
| File | Change |
|------|--------|
| `backend/routers/company/departments.py` | UPDATE - Preset PATCH endpoint |
| `frontend/src/components/DepartmentSettings.jsx` | UPDATE - Preset selector |

### Phase 3 (Chips)
| File | Change |
|------|--------|
| `backend/routers/conversations.py` | UPDATE - Accept modifier param |
| `frontend/src/components/ChatInterface.jsx` | UPDATE - Add chip UI |

### Phase 4 (LLM Hub)
| File | Change |
|------|--------|
| `frontend/src/pages/Settings/LLMHub.jsx` | NEW - Advanced settings |
| `backend/routers/company/llm_config.py` | NEW - Custom config endpoints |

---

## Department-to-Preset Mapping

Based on the council's recommendations:

| Department | Default Preset | Rationale |
|------------|---------------|-----------|
| Legal | conservative | Precision, compliance, deterministic |
| HR | conservative | Policy accuracy, consistency |
| Finance | conservative | Numbers, compliance |
| Marketing | creative | Varied ideas, engaging content |
| Content | creative | Creative writing, diverse angles |
| Sales | balanced | Persuasive but accurate |
| Executive | balanced | Strategic, comprehensive |
| Technical | balanced | Accurate but flexible |
| Standard | balanced | General purpose |

These are just defaults - admins can change per department.

---

## Validation & Safety

### Temperature Bounds
- Minimum: 0.0 (fully deterministic)
- Maximum: 1.2 (very creative but still coherent)
- Per-stage validation in backend

### Max Tokens Bounds
- Minimum: 256 (very short)
- Maximum: 8192 (very long)
- Cost warning when > 4096

### Conversation Modifiers
- Bounded adjustments (±0.15 temperature)
- Can't exceed preset's natural range
- Legal + "more creative" → 0.35 (not 0.9)

---

## Privacy Considerations

1. **Conversations are private** - RLS ensures users only see their own
2. **LLM config is department-level** - Not per-conversation (simpler)
3. **Audit logging** - Config changes logged in activity_logs
4. **No PII in LLM config** - Just parameters, no content

---

## Next Steps

1. **Review this plan** - Any concerns or changes?
2. **Run Phase 1 migration** - Add llm_config column + presets
3. **Update openrouter.py** - Add parameter support
4. **Create llm_config.py** - Config resolution
5. **Update council.py** - Wire it together
6. **Test** - Verify Legal vs Marketing behave differently

Ready to proceed with implementation?
