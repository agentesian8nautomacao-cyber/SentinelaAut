-- B16-C — Agent Gateway nonce replay protection (NOT applied in this authorization).
-- Atomic consume: INSERT ... ON CONFLICT (key_id, nonce) DO NOTHING

CREATE TABLE IF NOT EXISTS agent_gateway_nonces (
  key_id text NOT NULL,
  nonce text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_agent_gateway_nonces_expires
  ON agent_gateway_nonces (expires_at);

COMMENT ON TABLE agent_gateway_nonces IS
  'B16-C: one-time nonces for agent-v1 gateway (scoped by key_id).';
