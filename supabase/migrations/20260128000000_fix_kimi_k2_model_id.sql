-- Fix incorrect Kimi K2 model ID
-- The model ID was incorrectly set as 'moonshot/kimi-k2' in some frontend components
-- The correct OpenRouter model ID is 'moonshotai/kimi-k2'

-- Update any entries in model_registry with the wrong ID
UPDATE model_registry
SET model_id = 'moonshotai/kimi-k2'
WHERE model_id = 'moonshot/kimi-k2';

-- Also check llm_usage table in case usage was tracked with wrong ID
UPDATE llm_usage
SET model = 'moonshotai/kimi-k2'
WHERE model = 'moonshot/kimi-k2';

-- Log the fix (optional - comment out if parse_failures table doesn't exist)
-- INSERT INTO parse_failures (company_id, model, reason, text_preview)
-- SELECT DISTINCT company_id, 'moonshotai/kimi-k2', 'model_id_corrected_from_moonshot_to_moonshotai', NULL
-- FROM model_registry WHERE model_id = 'moonshotai/kimi-k2';
