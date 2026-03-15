-- A2A Protocol: Agent Registry + Task Lifecycle
--
-- Supports the agent-to-agent task protocol where external agents
-- register with the platform, submit structured tasks, and poll for results.

-- ──────────────────────────────────────────────
-- Agent Registry
-- ──────────────────────────────────────────────

CREATE TABLE public.agent_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Link to platform user who owns this agent (nullable for standalone agents)
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  callback_url text,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  trust_level text NOT NULL DEFAULT 'untrusted'
    CHECK (trust_level IN ('untrusted', 'verified', 'partner')),
  is_active boolean NOT NULL DEFAULT true,
  -- The hashed API key for this agent (plain key returned only on creation)
  api_key_hash text NOT NULL UNIQUE,
  -- Prefix of the key for identification (e.g., "ra_abc123")
  api_key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_registry_active ON public.agent_registry (is_active) WHERE is_active = true;
CREATE INDEX idx_agent_registry_trust ON public.agent_registry (trust_level);
CREATE INDEX idx_agent_registry_owner ON public.agent_registry (owner_user_id) WHERE owner_user_id IS NOT NULL;

-- RLS: service-role only (agents authenticate via API key, not Supabase session)
ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- A2A Tasks
-- ──────────────────────────────────────────────

CREATE TABLE public.a2a_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  target_agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  intent text NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'accepted', 'in_progress', 'completed', 'failed', 'rejected')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  correlation_id text,
  ttl_seconds integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_a2a_tasks_sender ON public.a2a_tasks (sender_agent_id);
CREATE INDEX idx_a2a_tasks_status ON public.a2a_tasks (status);
CREATE INDEX idx_a2a_tasks_intent ON public.a2a_tasks (intent);
CREATE INDEX idx_a2a_tasks_correlation ON public.a2a_tasks (correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_a2a_tasks_created ON public.a2a_tasks (created_at DESC);

-- RLS: service-role only
ALTER TABLE public.a2a_tasks ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Auto-update updated_at on task changes
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_a2a_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IN ('completed', 'failed', 'rejected') AND OLD.status NOT IN ('completed', 'failed', 'rejected') THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_a2a_task_updated_at
  BEFORE UPDATE ON public.a2a_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_a2a_task_updated_at();
