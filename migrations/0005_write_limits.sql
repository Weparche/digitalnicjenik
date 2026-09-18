-- Demo write mutation rate-limit buckets (one row per IP hash + hour window).
CREATE TABLE IF NOT EXISTS demo_write_rate_buckets (
  ip_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_demo_write_rate_buckets_updated
ON demo_write_rate_buckets(updated_at);

-- Checker probe rate-limit buckets.
CREATE TABLE IF NOT EXISTS checker_rate_buckets (
  ip_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (ip_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_checker_rate_buckets_updated
ON checker_rate_buckets(updated_at);

-- Optional audit artifact for uploads (not domain model).
ALTER TABLE price_uploads ADD COLUMN source_artifact_text TEXT;
