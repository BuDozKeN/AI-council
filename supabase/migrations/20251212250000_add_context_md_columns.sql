-- Add context_md columns to companies and departments tables
-- This stores the markdown documentation for company and department contexts

-- Add context_md to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS context_md TEXT;

-- Add context_md to departments table
ALTER TABLE departments ADD COLUMN IF NOT EXISTS context_md TEXT;

-- Add comment for documentation
COMMENT ON COLUMN companies.context_md IS 'Markdown documentation for company context (business overview, goals, constraints, etc.)';
COMMENT ON COLUMN departments.context_md IS 'Markdown documentation for department context (role details, technical decisions, etc.)';
