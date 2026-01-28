-- Comprehensive fix for incorrect Kimi K2 model ID
-- The model ID was incorrectly set as 'moonshot/kimi-k2' in various tables
-- The correct OpenRouter model ID is 'moonshotai/kimi-k2'

-- 1. Update model_registry table
UPDATE model_registry
SET model_id = 'moonshotai/kimi-k2'
WHERE model_id = 'moonshot/kimi-k2';

-- 2. Update llm_usage table
UPDATE llm_usage
SET model = 'moonshotai/kimi-k2'
WHERE model = 'moonshot/kimi-k2';

-- 3. Fix model_preferences in roles table (JSON array)
UPDATE roles
SET model_preferences = jsonb_set(
    model_preferences::jsonb,
    ARRAY[idx::text],
    '"moonshotai/kimi-k2"'::jsonb
)
FROM (
    SELECT id, idx
    FROM roles,
    jsonb_array_elements_text(model_preferences::jsonb) WITH ORDINALITY arr(model, idx)
    WHERE model = 'moonshot/kimi-k2'
) subquery
WHERE roles.id = subquery.id;

-- 4. Fix model_preferences in personas table (JSON array)
UPDATE personas
SET model_preferences = jsonb_set(
    model_preferences::jsonb,
    ARRAY[idx::text],
    '"moonshotai/kimi-k2"'::jsonb
)
FROM (
    SELECT id, idx
    FROM personas,
    jsonb_array_elements_text(model_preferences::jsonb) WITH ORDINALITY arr(model, idx)
    WHERE model = 'moonshot/kimi-k2'
) subquery
WHERE personas.id = subquery.id;

-- 5. Fix model_preferences in departments table if it exists (JSON array)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='departments' AND column_name='model_preferences') THEN
        UPDATE departments
        SET model_preferences = jsonb_set(
            model_preferences::jsonb,
            ARRAY[idx::text],
            '"moonshotai/kimi-k2"'::jsonb
        )
        FROM (
            SELECT id, idx
            FROM departments,
            jsonb_array_elements_text(model_preferences::jsonb) WITH ORDINALITY arr(model, idx)
            WHERE model = 'moonshot/kimi-k2'
        ) subquery
        WHERE departments.id = subquery.id;
    END IF;
END $$;

-- Log: Show how many records were affected (optional logging)
DO $$
DECLARE
    affected_count INTEGER := 0;
BEGIN
    -- Count affected personas
    SELECT COUNT(*) INTO affected_count
    FROM personas
    WHERE model_preferences::text LIKE '%moonshotai/kimi-k2%';

    IF affected_count > 0 THEN
        RAISE NOTICE 'Fixed model ID in % persona records', affected_count;
    END IF;
END $$;
