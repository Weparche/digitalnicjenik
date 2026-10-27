CREATE TABLE monitor_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  run_trigger TEXT NOT NULL CHECK (run_trigger IN ('cron', 'retry', 'manual')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'notifying', 'completed', 'skipped', 'failed')),
  requested_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  lease_token TEXT,
  lease_until TEXT,
  cursor INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT,
  result_run_id TEXT,
  error TEXT
);
CREATE UNIQUE INDEX monitor_jobs_active ON monitor_jobs(tenant_id) WHERE status IN ('queued', 'running', 'notifying');
CREATE INDEX monitor_jobs_tenant_recent ON monitor_jobs(tenant_id, requested_at DESC);
CREATE TABLE monitor_deliveries (
  job_id TEXT NOT NULL REFERENCES monitor_jobs(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, recipient)
);
