CREATE TABLE IF NOT EXISTS price_list_versions (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS publication_metadata (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_address TEXT NOT NULL,
  object_code TEXT NOT NULL,
  next_publication_sequence INTEGER NOT NULL DEFAULT 1,
  timezone TEXT NOT NULL DEFAULT 'Europe/Zagreb',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_uploads (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_filename TEXT NOT NULL,
  source_type TEXT NOT NULL,
  normalized_payload_json TEXT NOT NULL,
  validation_issues_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('uploaded', 'invalid', 'manual_review', 'ready_to_publish', 'published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_publications (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  price_list_id TEXT NOT NULL REFERENCES price_list_versions(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL,
  filename_stem TEXT NOT NULL UNIQUE,
  published_at TEXT NOT NULL,
  superseded_at TEXT,
  public_until TEXT,
  hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  UNIQUE (tenant_id, sequence)
);

CREATE TABLE IF NOT EXISTS publication_targets (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  current_publication_id TEXT REFERENCES price_publications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('validator', 'publisher_self_service', 'managed')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'expired')),
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_list_versions_tenant_created ON price_list_versions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_uploads_tenant_updated ON price_uploads(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_publications_tenant_published ON price_publications(tenant_id, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_publications_one_current ON price_publications(tenant_id) WHERE is_current = 1;
CREATE INDEX IF NOT EXISTS idx_publication_targets_hostname ON publication_targets(hostname);

ALTER TABLE sync_logs ADD COLUMN event_type TEXT;
ALTER TABLE sync_logs ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';
