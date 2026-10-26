-- Owner-configurable working days and closed dates for publication deadlines.
-- Existing accounts keep the previous Mon-Fri calendar until the owner updates it.
ALTER TABLE publication_metadata ADD COLUMN working_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]';
ALTER TABLE publication_metadata ADD COLUMN closed_dates_json TEXT NOT NULL DEFAULT '[]';
