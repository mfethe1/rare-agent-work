-- A2A Webhook Subscriptions & Delivery Log
--
-- Enables event-driven agent collaboration: agents subscribe to event
-- patterns and receive HMAC-signed HTTP callbacks when events fire.
-- Replaces polling with push for task.assigned, task.completed, etc.

-- ──────────────────────────────────────────────
-- Webhook Subscriptions
-- ──────────────────────────────────────────────

CREATE TABLE public.webhook_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  -- Array of event patterns: exact ("task.completed"), wildcard ("task.*"), or global ("*")
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- HMAC secret hash (SHA-256). Plain secret returned only at creation time.
  secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_subs_agent ON public.webhook_subscriptions (agent_id);
CREATE INDEX idx_webhook_subs_active ON public.webhook_subscriptions (is_active) WHERE is_active = true;

-- RLS: service-role only (agents auth via API key in app layer)
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Webhook Delivery Log
-- ──────────────────────────────────────────────

CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  response_status integer,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_webhook_del_sub ON public.webhook_deliveries (subscription_id);
CREATE INDEX idx_webhook_del_status ON public.webhook_deliveries (status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_del_retry ON public.webhook_deliveries (next_retry_at) WHERE next_retry_at IS NOT NULL AND status = 'retrying';
CREATE INDEX idx_webhook_del_created ON public.webhook_deliveries (created_at DESC);

-- RLS: service-role only
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Auto-update updated_at on subscription changes
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_webhook_sub_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_webhook_sub_updated_at
  BEFORE UPDATE ON public.webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_sub_updated_at();

-- ──────────────────────────────────────────────
-- Cleanup: purge old delivery records (> 7 days, terminal status)
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(retention_days integer DEFAULT 7)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.webhook_deliveries
  WHERE status IN ('delivered', 'failed')
    AND completed_at < now() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
