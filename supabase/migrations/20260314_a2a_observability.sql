-- A2A Distributed Tracing & Observability Schema
-- Supports: spans, metrics, anomalies

-- ──────────────────────────────────────────────
-- Spans (distributed tracing)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_spans (
  span_id       TEXT        NOT NULL,
  trace_id      TEXT        NOT NULL,
  parent_span_id TEXT,
  operation     TEXT        NOT NULL,
  kind          TEXT        NOT NULL DEFAULT 'internal'
                            CHECK (kind IN ('internal','client','server','producer','consumer')),
  agent_id      UUID        NOT NULL REFERENCES agent_registry(id),
  status        TEXT        NOT NULL DEFAULT 'unset'
                            CHECK (status IN ('unset','ok','error')),
  error_message TEXT,
  error_code    TEXT,
  attributes    JSONB       NOT NULL DEFAULT '{}',
  events        JSONB       NOT NULL DEFAULT '[]',
  links         JSONB       NOT NULL DEFAULT '[]',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_ms   INTEGER,

  PRIMARY KEY (trace_id, span_id)
);

CREATE INDEX idx_a2a_spans_trace    ON a2a_spans(trace_id);
CREATE INDEX idx_a2a_spans_agent    ON a2a_spans(agent_id);
CREATE INDEX idx_a2a_spans_started  ON a2a_spans(started_at DESC);
CREATE INDEX idx_a2a_spans_parent   ON a2a_spans(parent_span_id) WHERE parent_span_id IS NULL;
CREATE INDEX idx_a2a_spans_status   ON a2a_spans(status) WHERE status = 'error';
CREATE INDEX idx_a2a_spans_operation ON a2a_spans(operation);

-- ──────────────────────────────────────────────
-- Metrics (time-series data points)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_metrics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID        NOT NULL REFERENCES agent_registry(id),
  metric      TEXT        NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  tags        JSONB       NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_a2a_metrics_metric     ON a2a_metrics(metric, recorded_at DESC);
CREATE INDEX idx_a2a_metrics_agent      ON a2a_metrics(agent_id, metric, recorded_at DESC);
CREATE INDEX idx_a2a_metrics_recorded   ON a2a_metrics(recorded_at DESC);

-- ──────────────────────────────────────────────
-- Anomalies (detected deviations)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS a2a_anomalies (
  id                  TEXT        PRIMARY KEY,
  type                TEXT        NOT NULL
                                  CHECK (type IN ('latency_spike','error_burst','throughput_drop',
                                                  'agent_degradation','cascade_failure','sla_risk','cost_anomaly')),
  severity            TEXT        NOT NULL CHECK (severity IN ('info','warning','critical')),
  description         TEXT        NOT NULL,
  affected_agent_ids  UUID[]      NOT NULL DEFAULT '{}',
  related_trace_ids   TEXT[]      NOT NULL DEFAULT '{}',
  metric              TEXT        NOT NULL,
  observed_value      DOUBLE PRECISION NOT NULL,
  expected_value      DOUBLE PRECISION NOT NULL,
  deviation           DOUBLE PRECISION NOT NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_a2a_anomalies_active   ON a2a_anomalies(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_a2a_anomalies_type     ON a2a_anomalies(type);
CREATE INDEX idx_a2a_anomalies_severity ON a2a_anomalies(severity);
CREATE INDEX idx_a2a_anomalies_detected ON a2a_anomalies(detected_at DESC);

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE a2a_spans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE a2a_anomalies ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API routes use service role)
CREATE POLICY a2a_spans_service     ON a2a_spans     FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY a2a_metrics_service   ON a2a_metrics   FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY a2a_anomalies_service ON a2a_anomalies FOR ALL USING (TRUE) WITH CHECK (TRUE);
