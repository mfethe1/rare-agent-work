-- News articles table
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL,
  upvotes INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  score DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Article votes (anonymous, cookie-based)
CREATE TABLE IF NOT EXISTS article_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  voter_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, voter_token)
);

-- Model leaderboard
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT,
  tool_use_score DOUBLE PRECISION DEFAULT 0,
  context_recall_score DOUBLE PRECISION DEFAULT 0,
  coding_accuracy_score DOUBLE PRECISION DEFAULT 0,
  cost_efficiency_score DOUBLE PRECISION DEFAULT 0,
  overall_score DOUBLE PRECISION DEFAULT 0,
  context_window INTEGER,
  pricing_input DOUBLE PRECISION,
  pricing_output DOUBLE PRECISION,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Report drafts (pipeline review queue)
CREATE TABLE IF NOT EXISTS report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'researcher',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewer_notes TEXT,
  citation_check JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tier TEXT DEFAULT 'free',
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_score ON articles(score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_article_votes_article ON article_votes(article_id);
CREATE INDEX IF NOT EXISTS idx_models_slug ON models(slug);
CREATE INDEX IF NOT EXISTS idx_report_drafts_status ON report_drafts(status);

-- Enable Row Level Security
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Public read access for articles and models
CREATE POLICY "Public read articles" ON articles FOR SELECT USING (true);
CREATE POLICY "Public read models" ON models FOR SELECT USING (true);

-- Service role can do everything (for API routes)
CREATE POLICY "Service insert articles" ON articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update articles" ON articles FOR UPDATE USING (true);
CREATE POLICY "Service delete articles" ON articles FOR DELETE USING (true);

CREATE POLICY "Service insert votes" ON article_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Service read votes" ON article_votes FOR SELECT USING (true);

CREATE POLICY "Service all models" ON models FOR ALL USING (true);
CREATE POLICY "Service all drafts" ON report_drafts FOR ALL USING (true);
CREATE POLICY "Service all users" ON users FOR ALL USING (true);

-- Auto-compute score on insert/update (HN-style time decay)
CREATE OR REPLACE FUNCTION compute_article_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.score := (NEW.upvotes + 1.0) / POWER(EXTRACT(EPOCH FROM (now() - NEW.published_at)) / 3600.0 + 2.0, 1.5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_score_trigger
  BEFORE INSERT OR UPDATE OF upvotes ON articles
  FOR EACH ROW
  EXECUTE FUNCTION compute_article_score();
