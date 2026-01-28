-- Add Kimi K2.5 to model registry
-- Kimi K2.5 is Moonshot AI's multimodal model with visual coding and agentic capabilities
-- Pricing: $0.57/M input, $2.85/M output
-- Role: Stage 1 (council_member) - premium analyst

-- Add to model_registry for council_member role (Stage 1)
INSERT INTO model_registry (role, model_id, display_name, priority, description, is_premium)
VALUES
('council_member', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 5, 'Multimodal + agentic tool-calling', true)
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- Optional: Add as alternative for stage2_reviewer (can be used in both stages)
-- Uncomment if you want K2.5 available in Stage 2 as well:
-- INSERT INTO model_registry (role, model_id, display_name, priority, description, is_premium)
-- VALUES
-- ('stage2_reviewer', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 6, 'Multimodal + agentic', true)
-- ON CONFLICT (role, priority, company_id) DO NOTHING;
