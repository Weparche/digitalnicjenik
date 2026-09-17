CREATE TABLE IF NOT EXISTS lead_delivery_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_delivery_attempts_ip_created
ON lead_delivery_attempts(ip_hash, created_at DESC);

CREATE TRIGGER IF NOT EXISTS lead_delivery_attempts_hourly_limit
BEFORE INSERT ON lead_delivery_attempts
WHEN (
  SELECT COUNT(*)
  FROM lead_delivery_attempts
  WHERE ip_hash = NEW.ip_hash
    AND datetime(created_at) >= datetime(NEW.created_at, '-1 hour')
) >= 5
BEGIN
  SELECT RAISE(ABORT, 'lead rate limit exceeded');
END;
