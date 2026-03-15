-- A2A Agent Service Mesh
--
-- Production-grade resilience infrastructure for the agent ecosystem.
-- Circuit breakers, mesh policies, and bulkhead partitions — all persisted
-- in the DB so state survives serverless cold starts and is consistent
-- across all edge instances.

-- ──────────────────────────────────────────────
-- Circuit Breakers
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_circuit_breakers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL UNIQUE REFERENCES agent_registry(id) ON DELETE CASCADE,

  -- State machine
  state                 TEXT NOT NULL DEFAULT 'closed'
                        CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count         INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  success_count         INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),

  -- Configuration
  failure_threshold     INTEGER NOT NULL DEFAULT 5 CHECK (failure_threshold >= 1),
  recovery_threshold    INTEGER NOT NULL DEFAULT 3 CHECK (recovery_threshold >= 1),
  open_duration_ms      INTEGER NOT NULL DEFAULT 30000 CHECK (open_duration_ms >= 1000),
  evaluation_window_ms  INTEGER NOT NULL DEFAULT 60000 CHECK (evaluation_window_ms >= 5000),
  failure_rate_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.5000
                        CHECK (failure_rate_threshold > 0 AND failure_rate_threshold <= 1),

  -- Sliding window metrics
  window_request_count  INTEGER NOT NULL DEFAULT 0 CHECK (window_request_count >= 0),

  -- Timestamps
  last_tripped_at       TIMESTAMPTZ,
  last_failure_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_circuit_breakers_agent ON a2a_circuit_breakers(agent_id);
CREATE INDEX idx_circuit_breakers_state ON a2a_circuit_breakers(state);

-- ──────────────────────────────────────────────
-- Mesh Policies
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_mesh_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name                  TEXT NOT NULL,
  capability_pattern    TEXT NOT NULL,  -- e.g., 'news.*', '*'

  -- Load balancing
  lb_strategy           TEXT NOT NULL DEFAULT 'adaptive'
                        CHECK (lb_strategy IN (
                          'weighted_round_robin',
                          'least_connections',
                          'latency_weighted',
                          'adaptive'
                        )),
  adaptive_weights      JSONB NOT NULL DEFAULT '{"latency":0.4,"error_rate":0.35,"load":0.25}',

  -- Circuit breaker overrides
  circuit_breaker_config JSONB NOT NULL DEFAULT '{
    "failure_threshold": 5,
    "recovery_threshold": 3,
    "open_duration_ms": 30000,
    "evaluation_window_ms": 60000,
    "failure_rate_threshold": 0.5
  }',

  -- Retry policy
  retry_policy          JSONB NOT NULL DEFAULT '{
    "max_retries": 3,
    "initial_delay_ms": 500,
    "backoff_multiplier": 2.0,
    "max_delay_ms": 10000,
    "jitter_factor": 0.25,
    "retryable_errors": ["timeout", "overloaded", "circuit_open", "agent_unavailable"],
    "non_retryable_errors": ["invalid_input", "unauthorized", "rejected"]
  }',

  -- Hedging policy
  hedging_policy        JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "max_parallel": 2,
    "hedge_delay_ms": 500,
    "latency_threshold_ms": 2000
  }',

  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(capability_pattern)
);

CREATE INDEX idx_mesh_policies_pattern ON a2a_mesh_policies(capability_pattern);
CREATE INDEX idx_mesh_policies_active ON a2a_mesh_policies(is_active) WHERE is_active = true;

-- ──────────────────────────────────────────────
-- Bulkhead Partitions
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_bulkhead_partitions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_agent_id     UUID NOT NULL REFERENCES agent_registry(id) ON DELETE CASCADE,
  consumer_agent_id     TEXT NOT NULL,  -- UUID or '*' for default partition

  -- Capacity limits
  max_concurrent        INTEGER NOT NULL DEFAULT 10 CHECK (max_concurrent >= 1),
  max_queue_size        INTEGER NOT NULL DEFAULT 50 CHECK (max_queue_size >= 0),

  -- Runtime counters
  active_count          INTEGER NOT NULL DEFAULT 0 CHECK (active_count >= 0),
  queue_depth           INTEGER NOT NULL DEFAULT 0 CHECK (queue_depth >= 0),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One partition per provider-consumer pair
  UNIQUE(provider_agent_id, consumer_agent_id)
);

CREATE INDEX idx_bulkhead_provider ON a2a_bulkhead_partitions(provider_agent_id);
CREATE INDEX idx_bulkhead_consumer ON a2a_bulkhead_partitions(consumer_agent_id);

-- ──────────────────────────────────────────────
-- Seed default wildcard mesh policy
-- ──────────────────────────────────────────────

INSERT INTO a2a_mesh_policies (name, capability_pattern, lb_strategy)
VALUES ('Default Global Policy', '*', 'adaptive')
ON CONFLICT (capability_pattern) DO NOTHING;
