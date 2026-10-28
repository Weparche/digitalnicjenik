-- Web Link plan (19,90 €/god): public link, CSV/XML, archive — without monitoring or item editing.
-- Recreate entitlements to widen the plan CHECK (SQLite cannot alter a CHECK constraint).
CREATE TABLE entitlements_new (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('validator', 'web_link', 'publisher_self_service', 'managed')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'suspended')),
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO entitlements_new (id, tenant_id, plan, status, period_start, period_end, created_at, updated_at)
SELECT id, tenant_id, plan, status, period_start, period_end, created_at, updated_at FROM entitlements;

DROP TABLE entitlements;
ALTER TABLE entitlements_new RENAME TO entitlements;

CREATE INDEX IF NOT EXISTS idx_entitlements_tenant ON entitlements(tenant_id, created_at DESC);

-- Bank-transfer orders (HUB-3 2D barcode). `number` is DB-generated, so concurrent orders never share a reference.
CREATE TABLE IF NOT EXISTS payment_orders (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('web_link', 'publisher_upgrade')),
  installation INTEGER NOT NULL DEFAULT 0 CHECK (installation IN (0, 1)),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  customer_type TEXT NOT NULL CHECK (customer_type IN ('company', 'person')),
  billing_name TEXT NOT NULL,
  oib TEXT,
  address TEXT NOT NULL,
  postal_city TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  grace_granted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_one_pending ON payment_orders(tenant_id, kind) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status, created_at DESC);
