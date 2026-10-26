-- First-touch house-ad attribution. The chain key is attribution_id, not email.
CREATE TABLE IF NOT EXISTS acquisition_attributions (
  id TEXT PRIMARY KEY NOT NULL,
  attribution_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lead', 'signup', 'trial', 'upgrade')),
  subject_id TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  first_seen TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (attribution_id, kind, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_acquisition_attributions_source
ON acquisition_attributions(utm_source, kind);

-- Trial tenants are created only after the e-mail link. Keep the touch on the claim until then.
ALTER TABLE pending_trial_claims ADD COLUMN attribution_json TEXT;
