-- B16-D2 — Agent Gateway identity registry (NOT applied until operator authorizes).

-- Service-role / DATABASE_URL only — no RLS for anon/authenticated app users.



CREATE TABLE IF NOT EXISTS agent_gateway_identities (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  slug text UNIQUE NOT NULL,

  display_name text NOT NULL DEFAULT '',

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  revoked_at timestamptz NULL,

  revoked_by text NULL

);



CREATE TABLE IF NOT EXISTS agent_gateway_identity_keys (

  identity_id uuid NOT NULL REFERENCES agent_gateway_identities (id) ON DELETE CASCADE,

  key_id text NOT NULL CHECK (key_id ~ '^[A-Za-z0-9_.:-]{3,64}$'),

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),

  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  revoked_at timestamptz NULL,

  PRIMARY KEY (identity_id, key_id)

);



CREATE TABLE IF NOT EXISTS agent_gateway_internal_credentials (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  identity_id uuid NOT NULL REFERENCES agent_gateway_identities (id) ON DELETE CASCADE,

  token_hash text NOT NULL,

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),

  label text NOT NULL DEFAULT '',

  created_at timestamptz NOT NULL DEFAULT now(),

  expires_at timestamptz NULL,

  last_used_at timestamptz NULL,

  UNIQUE (token_hash)

);



CREATE INDEX IF NOT EXISTS idx_agent_gateway_internal_credentials_identity

  ON agent_gateway_internal_credentials (identity_id);



COMMENT ON TABLE agent_gateway_identities IS 'B16-D2: technical identity for external agent gateway callers.';

COMMENT ON TABLE agent_gateway_identity_keys IS 'B16-D2: authorized key_id per identity (nonce + HMAC scope).';

COMMENT ON TABLE agent_gateway_internal_credentials IS 'B16-D2: SHA-256 hex hashes of internal API tokens; never store plaintext.';

COMMENT ON COLUMN agent_gateway_internal_credentials.token_hash IS 'Lowercase SHA-256 hex of bearer token.';
