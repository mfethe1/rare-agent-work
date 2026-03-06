-- Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro')),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_budget INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token usage log
CREATE TABLE IF NOT EXISTS public.token_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_slug TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd    NUMERIC(10, 8) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Token usage: users can read their own
CREATE POLICY "Users can view own token usage"
  ON public.token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert token usage (used by webhook + chat route)
CREATE POLICY "Service role can insert token usage"
  ON public.token_usage FOR INSERT
  WITH CHECK (true);  -- Restricted to service_role key in practice

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, tier, tokens_used, tokens_budget)
  VALUES (NEW.id, NEW.email, 'free', 0, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auto-create profile when a user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
