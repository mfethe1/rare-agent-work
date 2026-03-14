-- Report purchases table: tracks one-time report purchases by Stripe session
-- Used to verify and unlock report content post-purchase (no Supabase auth required)
CREATE TABLE IF NOT EXISTS public.report_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  customer_email TEXT NOT NULL,
  report_slug TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast session-based lookups (post-purchase redirect)
CREATE INDEX IF NOT EXISTS report_purchases_session_idx ON public.report_purchases (stripe_session_id);
-- Index for email-based lookups (account page, re-access)
CREATE INDEX IF NOT EXISTS report_purchases_email_idx ON public.report_purchases (customer_email);

ALTER TABLE public.report_purchases ENABLE ROW LEVEL SECURITY;

-- Public read by session ID (used by the verify endpoint with service key)
-- No user-level RLS needed — verification is done server-side via service key
CREATE POLICY "Service role full access" ON public.report_purchases
  USING (true)
  WITH CHECK (true);
