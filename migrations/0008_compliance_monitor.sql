-- Compliance Monitor: tenant compliance profile + run history + alert state.

-- products | services. Default keeps existing tenants working; service tenants are classified explicitly below.
ALTER TABLE publication_metadata ADD COLUMN compliance_profile TEXT NOT NULL DEFAULT 'products'
  CHECK (compliance_profile IN ('products', 'services'));

-- Known service tenants. Add every other service-provider slug here (or run the same UPDATE by hand)
-- BEFORE the first monitor run, otherwise product-only rules will raise false warnings.
UPDATE publication_metadata
SET compliance_profile = 'services'
WHERE tenant_id IN (SELECT id FROM tenants WHERE slug IN ('patrisa-sisa'));

CREATE TABLE IF NOT EXISTS monitor_runs (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  publication_id TEXT,
  checked_at TEXT NOT NULL,
  run_trigger TEXT NOT NULL CHECK (run_trigger IN ('cron', 'retry', 'manual')),
  ruleset TEXT NOT NULL,
  profile TEXT NOT NULL CHECK (profile IN ('products', 'services')),
  overall TEXT NOT NULL CHECK (overall IN ('ok', 'warn', 'fail', 'skipped')),
  csv_status INTEGER,
  xml_status INTEGER,
  csv_rows INTEGER,
  xml_rows INTEGER,
  expected_rows INTEGER,
  prev_rows INTEGER,
  filename_publication_match INTEGER,
  filename_ruleset_match INTEGER,
  filename_csv TEXT,
  filename_xml TEXT,
  freshness_status TEXT NOT NULL DEFAULT 'n/a' CHECK (freshness_status IN ('ok', 'warn', 'n/a')),
  archive_expected INTEGER,
  archive_available INTEGER,
  archive_latest_status INTEGER,
  archive_oldest_status INTEGER,
  payload_sha256 TEXT,
  csv_sha256 TEXT,
  xml_sha256 TEXT,
  issues_json TEXT NOT NULL DEFAULT '[]',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  publication_sequence INTEGER
);

CREATE INDEX IF NOT EXISTS idx_monitor_runs_tenant_checked ON monitor_runs(tenant_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS monitor_state (
  tenant_id TEXT PRIMARY KEY NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  last_overall TEXT,
  last_ok_at TEXT,
  last_alert_at TEXT,
  last_alert_kind TEXT,
  alert_open INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_manual_at TEXT
);
