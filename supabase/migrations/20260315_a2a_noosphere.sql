-- A2A Noosphere — Collective Intelligence & Distributed Cognition
-- Cognitive sessions, thought streams, shared working memory, attention, fusion, provenance

-- ── Cognitive Sessions ──────────────────────────────────────────────────────

create table if not exists a2a_cognitive_sessions (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  goal_type text not null check (goal_type in (
    'problem_solving', 'hypothesis_generation', 'creative_synthesis',
    'adversarial_analysis', 'knowledge_integration', 'decision_making',
    'root_cause_analysis', 'futures_exploration'
  )),
  status text not null default 'forming' check (status in (
    'forming', 'active', 'converging', 'concluded', 'dissolved', 'suspended'
  )),
  initiator_agent_id uuid not null references a2a_agents(id),
  participant_agent_ids uuid[] not null default '{}',
  min_participants int not null default 2,
  max_participants int not null default 20,
  attention_budget jsonb not null default '{}',
  constitutional_constraints jsonb not null default '[]',
  required_domains text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  concluded_at timestamptz
);

create index idx_cognitive_sessions_status on a2a_cognitive_sessions(status);
create index idx_cognitive_sessions_initiator on a2a_cognitive_sessions(initiator_agent_id);
create index idx_cognitive_sessions_goal_type on a2a_cognitive_sessions(goal_type);

-- ── Thoughts ────────────────────────────────────────────────────────────────

create table if not exists a2a_thoughts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references a2a_cognitive_sessions(id) on delete cascade,
  agent_id uuid not null references a2a_agents(id),
  type text not null check (type in (
    'observation', 'hypothesis', 'evidence', 'critique', 'synthesis',
    'refinement', 'question', 'action_proposal', 'meta_cognitive'
  )),
  content text not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  parent_thought_ids uuid[] not null default '{}',
  contradicts uuid[] not null default '{}',
  domain text not null,
  cognitive_units real not null default 0,
  embedding vector(1536),  -- for semantic similarity if pgvector available
  constraint_check jsonb not null default '{"passed": true}',
  created_at timestamptz not null default now()
);

create index idx_thoughts_session on a2a_thoughts(session_id);
create index idx_thoughts_agent on a2a_thoughts(agent_id);
create index idx_thoughts_type on a2a_thoughts(type);
create index idx_thoughts_session_created on a2a_thoughts(session_id, created_at);

-- ── Thought Endorsements ────────────────────────────────────────────────────

create table if not exists a2a_thought_endorsements (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null references a2a_thoughts(id) on delete cascade,
  agent_id uuid not null references a2a_agents(id),
  strength real not null check (strength >= -1 and strength <= 1),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (thought_id, agent_id)
);

create index idx_endorsements_thought on a2a_thought_endorsements(thought_id);

-- ── Working Memory Artifacts ────────────────────────────────────────────────

create table if not exists a2a_cognitive_artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references a2a_cognitive_sessions(id) on delete cascade,
  type text not null check (type in (
    'hypothesis_set', 'evidence_map', 'contradiction_log', 'synthesis_draft',
    'decision_matrix', 'causal_model', 'knowledge_fragment', 'action_plan'
  )),
  content jsonb not null default '{}',
  version int not null default 1,
  contributor_agent_ids uuid[] not null default '{}',
  source_thought_ids uuid[] not null default '{}',
  lock_agent_id uuid,
  lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_artifacts_session on a2a_cognitive_artifacts(session_id);

-- ── Artifact Revision History ───────────────────────────────────────────────

create table if not exists a2a_artifact_revisions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references a2a_cognitive_artifacts(id) on delete cascade,
  version int not null,
  agent_id uuid not null references a2a_agents(id),
  delta jsonb not null,
  rationale text not null,
  created_at timestamptz not null default now()
);

create index idx_revisions_artifact on a2a_artifact_revisions(artifact_id, version);

-- ── Attention Signals ───────────────────────────────────────────────────────

create table if not exists a2a_attention_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references a2a_cognitive_sessions(id) on delete cascade,
  agent_id uuid not null references a2a_agents(id),
  type text not null check (type in (
    'focus_request', 'breakthrough', 'contradiction_found', 'convergence_signal',
    'divergence_needed', 'resource_warning', 'stagnation_alert'
  )),
  target text not null,
  priority real not null check (priority >= 0 and priority <= 1),
  context text not null,
  acknowledgements int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_signals_session on a2a_attention_signals(session_id);

-- ── Emergent Conclusions ────────────────────────────────────────────────────

create table if not exists a2a_emergent_conclusions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references a2a_cognitive_sessions(id) on delete cascade,
  content text not null,
  fusion_strategy text not null,
  confidence real not null check (confidence >= 0 and confidence <= 1),
  emergence_score real not null check (emergence_score >= 0 and emergence_score <= 1),
  source_thought_ids uuid[] not null default '{}',
  contributor_agent_ids uuid[] not null default '{}',
  dissent jsonb not null default '[]',
  constraint_check jsonb not null default '{"passed": true}',
  created_at timestamptz not null default now()
);

create index idx_conclusions_session on a2a_emergent_conclusions(session_id);

-- ── Insight Provenance ──────────────────────────────────────────────────────

create table if not exists a2a_insight_provenance (
  id uuid primary key default gen_random_uuid(),
  conclusion_id uuid not null references a2a_emergent_conclusions(id) on delete cascade,
  reasoning_chain jsonb not null default '[]',
  thought_graph jsonb not null default '[]',
  contribution_weights jsonb not null default '{}',
  started_at timestamptz not null,
  completed_at timestamptz not null
);

create index idx_provenance_conclusion on a2a_insight_provenance(conclusion_id);
