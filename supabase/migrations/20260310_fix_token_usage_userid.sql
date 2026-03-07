-- Drop dependent view and policies first
DROP VIEW IF EXISTS user_monthly_costs;
DROP POLICY IF EXISTS "Users can view own usage" ON token_usage;
DROP POLICY IF EXISTS "Service all token_usage" ON token_usage;

-- Drop FK constraint before type change
ALTER TABLE token_usage DROP CONSTRAINT IF EXISTS token_usage_user_id_fkey;

-- Change user_id to TEXT to support both UUID users and anonymous tracking
ALTER TABLE token_usage ALTER COLUMN user_id TYPE TEXT;

-- Recreate policies
CREATE POLICY "Service all token_usage" ON token_usage FOR ALL USING (true);

-- Recreate view
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
