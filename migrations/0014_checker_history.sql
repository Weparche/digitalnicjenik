-- Operational checker summaries only: no fetched bodies, IPs or inferred identity.
CREATE TABLE checker_runs (
  id TEXT PRIMARY KEY,
  checked_at TEXT NOT NULL,
  url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('green','yellow','red','unavailable')),
  score INTEGER CHECK(score BETWEEN 0 AND 9),
  unknown_count INTEGER NOT NULL CHECK(unknown_count BETWEEN 0 AND 9),
  checks_json TEXT NOT NULL,
  discovered_urls_json TEXT NOT NULL,
  acquisition_json TEXT,
  source TEXT NOT NULL CHECK(source IN ('landing','dashboard','legacy')),
  lead_id TEXT REFERENCES lead_inquiries(id) ON DELETE SET NULL
);
CREATE INDEX checker_runs_checked_at ON checker_runs(checked_at DESC,id);
CREATE INDEX checker_runs_hostname ON checker_runs(hostname,checked_at DESC);
CREATE INDEX checker_runs_score ON checker_runs(score,checked_at DESC);
