-- ============================================
-- Phase 2: Stage 2 Peer Review Cost Optimization
-- ============================================
-- Date: 2026-01-02
-- Purpose: Separate Stage 2 reviewers from Stage 1 council
--          to reduce peer review costs by ~90%
--
-- Current: Stage 2 uses same 5 premium models as Stage 1 (~$8,400/month)
-- New: Stage 2 uses 3 cheap, diverse models (~$800-1,000/month)
--
-- Savings: ~$7,000-8,000/month at 10k deliberations
--
-- Rollback: See bottom of file for rollback SQL
-- ============================================

-- Add Stage 2 reviewer models (new role)
INSERT INTO model_registry (role, model_id, display_name, priority, notes) VALUES
('stage2_reviewer', 'x-ai/grok-4-fast', 'Grok 4 Fast', 0, 'Primary reviewer - $0.20/$0.50 - very cheap, huge context'),
('stage2_reviewer', 'deepseek/deepseek-chat-v3-0324', 'DeepSeek V3', 1, 'Secondary reviewer - $0.28/$0.42 - strong reasoning'),
('stage2_reviewer', 'openai/gpt-4o-mini', 'GPT-4o Mini', 2, 'Tertiary reviewer - $0.15/$0.60 - diverse architecture');


-- ============================================
-- ROLLBACK SQL (if needed)
-- ============================================
-- Run this to remove the stage2_reviewer role:
--
-- DELETE FROM model_registry WHERE role = 'stage2_reviewer';
