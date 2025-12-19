-- ============================================
-- Add Missing Model Roles
-- ============================================
-- These roles were discovered as hardcoded in the codebase
-- and should be managed via the registry.
-- ============================================

-- Vision Analyzer (for image analysis in image_analyzer.py)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('vision_analyzer', 'openai/gpt-4o', 'GPT-4o', 0, 'Primary - excellent vision capabilities');

-- AI Polish (for text polishing in main.py /ai/polish endpoint)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('ai_polish', 'google/gemini-3-pro-preview', 'Gemini 3 Pro', 0, 'Primary - high quality text polish'),
('ai_polish', 'openai/gpt-4o', 'GPT-4o', 1, 'Fallback');
