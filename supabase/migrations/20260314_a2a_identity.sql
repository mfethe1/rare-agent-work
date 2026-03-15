-- A2A Cryptographic Agent Identity
--
-- Trust foundation for the agent ecosystem. Agents register Ed25519
-- public keys, prove identity through challenge-response, and sign
-- messages/delegations for verifiable authenticity.

-- ──────────────────────────────────────────────
-- Agent Public Keys
-- ──────────────────────────────────────────────

CREATE TABLE public.a2a_agent_public_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  algorithm text NOT NULL DEFAULT 'Ed25519'
    CHECK (algorithm IN ('Ed25519')),
  -- Base64url-encoded public key bytes
  public_key text NOT NULL,
  -- Human-readable label (e.g., "production", "backup")
  label text NOT NULL DEFAULT 'default',
  -- SHA-256 fingerprint for quick identification (colon-separated hex)
  fingerprint text NOT NULL,
  -- Whether this is the agent's primary signing key
  is_primary boolean NOT NULL DEFAULT false,
  -- Whether this key has been revoked
  is_revoked boolean NOT NULL DEFAULT false,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,

  -- A fingerprint can only be active once (prevents duplicate key registration)
  CONSTRAINT uq_fingerprint_active UNIQUE (fingerprint) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_a2a_public_keys_agent ON public.a2a_agent_public_keys (agent_id);
CREATE INDEX idx_a2a_public_keys_fingerprint ON public.a2a_agent_public_keys (fingerprint) WHERE is_revoked = false;
CREATE INDEX idx_a2a_public_keys_primary ON public.a2a_agent_public_keys (agent_id, is_primary) WHERE is_primary = true AND is_revoked = false;

-- Ensure at most one primary key per agent
CREATE UNIQUE INDEX uq_a2a_one_primary_key_per_agent
  ON public.a2a_agent_public_keys (agent_id)
  WHERE is_primary = true AND is_revoked = false;

ALTER TABLE public.a2a_agent_public_keys ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Identity Challenges (for challenge-response auth)
-- ──────────────────────────────────────────────

CREATE TABLE public.a2a_identity_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  key_id uuid NOT NULL REFERENCES public.a2a_agent_public_keys(id) ON DELETE CASCADE,
  -- Random nonce the agent must sign (base64url)
  nonce text NOT NULL,
  -- When this challenge expires
  expires_at timestamptz NOT NULL,
  -- Whether this challenge has been consumed (one-time use)
  is_consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_a2a_challenges_agent ON public.a2a_identity_challenges (agent_id);
CREATE INDEX idx_a2a_challenges_expires ON public.a2a_identity_challenges (expires_at)
  WHERE is_consumed = false;

ALTER TABLE public.a2a_identity_challenges ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- Cleanup: auto-delete expired challenges older than 1 hour
-- (run via pg_cron or application-level sweep)
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_identity_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM public.a2a_identity_challenges
  WHERE expires_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
