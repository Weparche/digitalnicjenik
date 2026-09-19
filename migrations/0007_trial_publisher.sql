-- Private anonymous drafts (payload in R2; D1 holds metadata)
CREATE TABLE IF NOT EXISTS publisher_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  payload_location TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  claimed_by_tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('temporary', 'claimed', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_publisher_drafts_expires ON publisher_drafts(expires_at);
CREATE INDEX IF NOT EXISTS idx_publisher_drafts_status ON publisher_drafts(status);

-- Trial claims: tenant is created only after magic-link verify
CREATE TABLE IF NOT EXISTS pending_trial_claims (
  id TEXT PRIMARY KEY NOT NULL,
  draft_id TEXT NOT NULL REFERENCES publisher_drafts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  requested_slug TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'provisioning', 'completed', 'expired')),
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_trial_claims_email ON pending_trial_claims(email);
CREATE INDEX IF NOT EXISTS idx_pending_trial_claims_slug ON pending_trial_claims(requested_slug);
CREATE INDEX IF NOT EXISTS idx_pending_trial_claims_status ON pending_trial_claims(status);

-- Soft slug holds during claim window (UNIQUE tenants.slug remains source of truth)
CREATE TABLE IF NOT EXISTS slug_reservations (
  slug TEXT PRIMARY KEY NOT NULL,
  claim_id TEXT NOT NULL REFERENCES pending_trial_claims(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Recreate entitlements with trial | active | expired | suspended
CREATE TABLE entitlements_new (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('validator', 'publisher_self_service', 'managed')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'suspended')),
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO entitlements_new (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at)
SELECT
  id,
  tenant_id,
  plan,
  CASE
    WHEN status = 'inactive' THEN 'expired'
    WHEN status = 'expired' THEN 'expired'
    ELSE 'active'
  END,
  period_start,
  COALESCE(period_end, created_at),
  created_at,
  updated_at
FROM entitlements;

DROP TABLE entitlements;
ALTER TABLE entitlements_new RENAME TO entitlements;

CREATE INDEX IF NOT EXISTS idx_entitlements_tenant ON entitlements(tenant_id, created_at DESC);

-- Lock slug after first publish (NULL = unlocked, set once)
ALTER TABLE tenants ADD COLUMN slug_locked_at TEXT;
