-- Keep internal QA separate without rewriting older public/legacy history.
ALTER TABLE checker_runs ADD COLUMN is_internal INTEGER NOT NULL DEFAULT 0 CHECK(is_internal IN (0,1));
CREATE INDEX checker_runs_internal_time ON checker_runs(is_internal,checked_at DESC);
CREATE TABLE checker_interactions (
 run_id TEXT NOT NULL REFERENCES checker_runs(id) ON DELETE CASCADE,
 event TEXT NOT NULL CHECK(event IN ('upload_click','upload','order')),
 created_at TEXT NOT NULL,
 PRIMARY KEY(run_id,event)
);
