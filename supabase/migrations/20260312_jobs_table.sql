-- Jobs table for async job queue tracking
-- This provides persistent storage and audit trail for background jobs

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON public.jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON public.jobs(priority);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_for ON public.jobs(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority ON public.jobs(status, priority, created_at);

-- RLS policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Only service role can access jobs (no public access)
CREATE POLICY "Service role can manage jobs" ON public.jobs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jobs_updated_at();

-- Function to clean up old completed/failed jobs (retention policy)
CREATE OR REPLACE FUNCTION public.cleanup_old_jobs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete completed jobs older than 30 days
  DELETE FROM public.jobs
  WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete failed jobs older than 90 days
  DELETE FROM public.jobs
  WHERE status = 'failed'
    AND updated_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- This is commented out by default - enable if you have pg_cron installed
-- SELECT cron.schedule('cleanup-old-jobs', '0 2 * * *', 'SELECT public.cleanup_old_jobs()');

COMMENT ON TABLE public.jobs IS 'Background job queue for async processing';
COMMENT ON COLUMN public.jobs.type IS 'Job type identifier (e.g., stripe.subscription.created)';
COMMENT ON COLUMN public.jobs.status IS 'Current job status';
COMMENT ON COLUMN public.jobs.priority IS 'Job priority level';
COMMENT ON COLUMN public.jobs.payload IS 'Job input data as JSON';
COMMENT ON COLUMN public.jobs.result IS 'Job output/result as JSON';
COMMENT ON COLUMN public.jobs.error IS 'Error message if job failed';
COMMENT ON COLUMN public.jobs.attempts IS 'Number of processing attempts';
COMMENT ON COLUMN public.jobs.max_attempts IS 'Maximum retry attempts allowed';
COMMENT ON COLUMN public.jobs.scheduled_for IS 'When to process this job (for delayed jobs)';

