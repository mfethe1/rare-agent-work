-- Users profile table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','starter','pro')),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_budget INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Token usage log
CREATE TABLE IF NOT EXISTS public.token_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  report_slug TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON public.token_usage FOR SELECT USING (auth.uid() = user_id);

-- Articles table for HN feed
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are public" ON public.articles FOR SELECT USING (true);

-- Article upvotes (cookie-based, anonymous)
CREATE TABLE IF NOT EXISTS public.article_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, voter_token)
);
ALTER TABLE public.article_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are public" ON public.article_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can vote" ON public.article_votes FOR INSERT WITH CHECK (true);

-- Model leaderboard
CREATE TABLE IF NOT EXISTS public.models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  tool_use_score NUMERIC(3,1),
  context_recall_score NUMERIC(3,1),
  coding_score NUMERIC(3,1),
  cost_per_1k_tokens NUMERIC(8,4),
  context_window INTEGER,
  best_for TEXT[],
  pricing_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Models are public" ON public.models FOR SELECT USING (true);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, tier, tokens_budget)
  VALUES (NEW.id, NEW.email, 'free', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
