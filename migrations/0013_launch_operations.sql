-- Additive launch metadata. Legacy trial deadlines are deliberately preserved.
ALTER TABLE entitlements ADD COLUMN paid_confirmed_at TEXT;
ALTER TABLE entitlements ADD COLUMN grace_until TEXT;
ALTER TABLE price_uploads ADD COLUMN base_publication_id TEXT;
ALTER TABLE price_uploads ADD COLUMN base_metadata_updated_at TEXT;
ALTER TABLE auth_users ADD COLUMN email_verified_at TEXT;
UPDATE auth_users SET email_verified_at = COALESCE(
  (SELECT MIN(created_at) FROM auth_sessions WHERE user_id = auth_users.id),
  (SELECT MIN(used_at) FROM magic_link_tokens WHERE user_id = auth_users.id AND used_at IS NOT NULL),
  (SELECT MIN(verified_at) FROM pending_trial_claims WHERE lower(email) = lower(auth_users.email) AND verified_at IS NOT NULL)
);
ALTER TABLE magic_link_tokens ADD COLUMN return_path TEXT NOT NULL DEFAULT '/app';

-- Preserve old IDs, references, amounts and payment history when widening kind.
CREATE TABLE payment_orders_launch (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('web_link','publisher','publisher_upgrade','web_publisher','installation')),
  installation INTEGER NOT NULL DEFAULT 0 CHECK (installation IN (0,1)),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  customer_type TEXT NOT NULL CHECK (customer_type IN ('company','person')),
  billing_name TEXT NOT NULL, oib TEXT, address TEXT NOT NULL, postal_city TEXT NOT NULL, email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, paid_at TEXT, grace_granted_at TEXT,
  payment_reported_at TEXT,
  confirmed_period_end TEXT,
  confirmed_plan TEXT
);
INSERT INTO payment_orders_launch (number,reference,tenant_id,kind,installation,amount_cents,customer_type,billing_name,oib,address,postal_city,email,status,created_at,updated_at,paid_at,grace_granted_at)
SELECT number,reference,tenant_id,kind,installation,amount_cents,customer_type,billing_name,oib,address,postal_city,email,status,created_at,updated_at,paid_at,grace_granted_at FROM payment_orders;
UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'payment_orders'),0)) WHERE name = 'payment_orders_launch';
DROP TABLE payment_orders;
ALTER TABLE payment_orders_launch RENAME TO payment_orders;
CREATE UNIQUE INDEX idx_payment_orders_one_pending ON payment_orders(tenant_id,kind) WHERE status = 'pending';
CREATE INDEX idx_payment_orders_status ON payment_orders(status,created_at DESC);

-- Only actual recorded annual payments prove grace eligibility. Manual legacy
-- bank transfers are confirmed explicitly by an audited admin action.
UPDATE entitlements SET paid_confirmed_at = (
  SELECT MAX(paid_at) FROM payment_orders WHERE tenant_id = entitlements.tenant_id AND status = 'paid' AND kind = 'web_link' AND julianday(paid_at)=julianday(entitlements.period_start)
), grace_until = strftime('%Y-%m-%dT%H:%M:%fZ',period_end,'+7 days')
WHERE plan != 'validator' AND status != 'trial' AND EXISTS (
  SELECT 1 FROM payment_orders WHERE tenant_id = entitlements.tenant_id AND status = 'paid' AND kind = 'web_link' AND julianday(paid_at)=julianday(entitlements.period_start)
);

CREATE TABLE admin_audit (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  actor_id TEXT NOT NULL, actor_email TEXT, actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id),
  order_reference TEXT,
  reason TEXT NOT NULL,
  old_json TEXT NOT NULL,
  new_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX admin_audit_tenant ON admin_audit(tenant_id,created_at DESC);

ALTER TABLE upgrade_requests ADD COLUMN service TEXT;
ALTER TABLE upgrade_requests ADD COLUMN template_id TEXT;
ALTER TABLE upgrade_requests ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'new';
UPDATE upgrade_requests SET workflow_status = 'resolved' WHERE status = 'done';
CREATE TABLE lead_inquiries (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
  website TEXT, message TEXT, context_json TEXT NOT NULL DEFAULT '{}', selected_plan TEXT, template_id TEXT,
  attachment_key TEXT, attachment_name TEXT, attachment_type TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE lifecycle_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, entity_id TEXT, period_key TEXT,
  audience TEXT NOT NULL CHECK(audience IN ('owner','ops','email')),
  recipient_email TEXT,
  payload_json TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','cancelled','attention')),
  lease_token TEXT, lease_until TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX lifecycle_due ON lifecycle_events(status,scheduled_at);
CREATE INDEX lifecycle_tenant ON lifecycle_events(tenant_id,scheduled_at);
CREATE TABLE lifecycle_deliveries (
  event_id TEXT NOT NULL REFERENCES lifecycle_events(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','sending','accepted','failed','uncertain')),
  attempts INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT, sent_at TEXT, provider_id TEXT, provider_status TEXT, error TEXT,
  PRIMARY KEY(event_id,recipient)
);
CREATE TABLE monitor_incidents (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, opened_at TEXT NOT NULL, resolved_at TEXT
);
CREATE UNIQUE INDEX monitor_incident_open ON monitor_incidents(tenant_id,kind) WHERE resolved_at IS NULL;
CREATE TABLE daily_publication_jobs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  publication_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
  expected_publication_id TEXT, draft_id TEXT, lease_token TEXT, lease_until TEXT,
  error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(tenant_id,publication_day)
);
