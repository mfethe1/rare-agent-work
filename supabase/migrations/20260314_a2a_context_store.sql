-- ============================================================
-- A2A Shared Agent Context Store
-- ============================================================
-- Enables agents to persist, share, and query collaborative
-- knowledge within multi-step workflows. Context entries are
-- scoped by namespace and optionally linked to tasks via
-- correlation_id for workflow-level knowledge sharing.
--
-- Design principles:
--   1. Agents own their context entries (write isolation)
--   2. Context is readable by any authenticated agent (read sharing)
--   3. TTL-based auto-expiry prevents unbounded growth
--   4. Namespaces allow logical partitioning (e.g., "research", "decisions")
--   5. Correlation IDs link context to multi-step task chains
-- ============================================================

-- Context entries table
create table if not exists agent_contexts (
  id              uuid primary key default gen_random_uuid(),

  -- Who wrote this context
  agent_id        uuid not null references agent_registry(id) on delete cascade,

  -- Logical namespace for partitioning (e.g., "research", "decisions", "errors")
  namespace       text not null default 'default',

  -- Machine-readable key within the namespace (e.g., "market_analysis_q1")
  key             text not null,

  -- The context payload — arbitrary structured data
  value           jsonb not null default '{}'::jsonb,

  -- Optional: link to a task workflow via correlation_id
  correlation_id  text,

  -- Optional: link to a specific task
  task_id         uuid references a2a_tasks(id) on delete set null,

  -- Content type hint for consuming agents
  content_type    text not null default 'application/json',

  -- TTL: context auto-expires after this many seconds from creation
  ttl_seconds     integer not null default 3600 check (ttl_seconds >= 60 and ttl_seconds <= 604800),

  -- Computed expiry timestamp (set by trigger)
  expires_at      timestamptz not null,

  -- Metadata
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Uniqueness: one entry per agent per namespace per key
  constraint agent_contexts_unique_key unique (agent_id, namespace, key)
);

-- Indexes for common query patterns
create index if not exists idx_agent_contexts_agent
  on agent_contexts (agent_id);

create index if not exists idx_agent_contexts_namespace
  on agent_contexts (namespace);

create index if not exists idx_agent_contexts_correlation
  on agent_contexts (correlation_id)
  where correlation_id is not null;

create index if not exists idx_agent_contexts_task
  on agent_contexts (task_id)
  where task_id is not null;

create index if not exists idx_agent_contexts_expiry
  on agent_contexts (expires_at);

-- Auto-update updated_at on modification
create or replace function update_agent_context_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

create trigger trg_agent_context_updated_at
  before update on agent_contexts
  for each row execute function update_agent_context_updated_at();

-- Auto-set expires_at from ttl_seconds on insert/update
create or replace function set_agent_context_expiry()
returns trigger as $$
begin
  NEW.expires_at = NEW.created_at + (NEW.ttl_seconds || ' seconds')::interval;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_agent_context_set_expiry
  before insert or update of ttl_seconds on agent_contexts
  for each row execute function set_agent_context_expiry();

-- Cleanup function: remove expired context entries
-- Should be called periodically (e.g., via cron or scheduled task)
create or replace function cleanup_expired_agent_contexts()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from agent_contexts where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql;

-- RLS: service-role only (API routes handle authorization)
alter table agent_contexts enable row level security;
