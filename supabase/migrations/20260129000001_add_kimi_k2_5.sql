-- Add Kimi K2.5 to model registry (all 3 stages)
-- Kimi K2.5 is Moonshot AI's multimodal model with visual coding and agentic capabilities
-- Pricing: $0.57/M input, $2.85/M output

-- Stage 1: Council Member (premium analyst)
INSERT INTO model_registry (role, model_id, display_name, priority, description, is_premium)
VALUES
('council_member', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 5, 'Multimodal + agentic tool-calling', true)
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- Stage 2: Reviewer (peer review)
INSERT INTO model_registry (role, model_id, display_name, priority, description, is_premium)
VALUES
('stage2_reviewer', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 6, 'Multimodal + agentic review', true)
ON CONFLICT (role, priority, company_id) DO NOTHING;

-- Stage 3: Chairman (synthesis)
INSERT INTO model_registry (role, model_id, display_name, priority, description, is_premium)
VALUES
('chairman', 'moonshotai/kimi-k2.5', 'Kimi K2.5', 4, 'Multimodal synthesis', true)
ON CONFLICT (role, priority, company_id) DO NOTHING;
