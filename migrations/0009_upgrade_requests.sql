-- Upgrade requests from the dashboard ("čeka uplatu"), so ops can see them in /admin
-- instead of relying on the notification e-mail alone. One open request per tenant+intent.
CREATE TABLE IF NOT EXISTS upgrade_requests (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('self_service', 'implementation', 'consultation')),
  requester_email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at TEXT NOT NULL,
  handled_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upgrade_requests_one_open ON upgrade_requests(tenant_id, intent) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status, created_at DESC);
