-- Private, owner-scoped reusable business profiles. Existing catalog metadata stays authoritative for published files.
CREATE TABLE IF NOT EXISTS publisher_business_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  merchant_type TEXT NOT NULL CHECK(merchant_type IN ('legal','natural')),
  merchant_identifier TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  billing_oib TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id,merchant_type,merchant_identifier)
);
CREATE INDEX IF NOT EXISTS idx_publisher_business_profiles_owner ON publisher_business_profiles(user_id,name);
