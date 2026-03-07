-- Token usage tracking — add missing columns to existing table
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS app TEXT NOT NULL DEFAULT 'ai-guide';
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6';
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS markup_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Add tokens_budget to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_budget INTEGER DEFAULT 50000;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_app ON token_usage(app);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at DESC);

-- RLS
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service all token_usage" ON token_usage FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Aggregate view: cost per user per month
CREATE OR REPLACE VIEW user_monthly_costs AS
SELECT
  user_id,
  user_email,
  app,
  date_trunc('month', created_at) AS month,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(cost_usd) AS total_provider_cost,
  SUM(markup_cost_usd) AS total_billed_cost
FROM token_usage
GROUP BY user_id, user_email, app, date_trunc('month', created_at);
