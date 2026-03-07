-- Report drafts awaiting Michael's approval
CREATE TABLE IF NOT EXISTS public.report_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1.0',
  changes_summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_notes TEXT,
  created_by TEXT DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.report_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Drafts are viewable by authenticated" ON public.report_drafts FOR SELECT USING (true);
CREATE POLICY "Service role can manage drafts" ON public.report_drafts FOR ALL USING (true);
