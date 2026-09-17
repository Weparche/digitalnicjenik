-- A publication without an active target is not safely addressable. Abort the
-- insert inside the same D1 batch so superseding/current-pointer changes roll
-- back together with the new immutable row.
CREATE TRIGGER IF NOT EXISTS price_publications_require_active_target
BEFORE INSERT ON price_publications
WHEN NOT EXISTS (
  SELECT 1 FROM publication_targets
  WHERE tenant_id = NEW.tenant_id AND status = 'active'
)
BEGIN
  SELECT RAISE(ABORT, 'publication target missing');
END;

-- The pointer is part of the tenant boundary. A plain FK on publication id
-- cannot prevent a target from pointing at another tenant's publication.
CREATE TRIGGER IF NOT EXISTS publication_targets_tenant_pointer_guard
BEFORE INSERT ON publication_targets
WHEN NEW.current_publication_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM price_publications
    WHERE id = NEW.current_publication_id AND tenant_id = NEW.tenant_id
  )
BEGIN
  SELECT RAISE(ABORT, 'publication target tenant mismatch');
END;

CREATE TRIGGER IF NOT EXISTS publication_targets_tenant_pointer_update_guard
BEFORE UPDATE OF tenant_id, current_publication_id ON publication_targets
WHEN NEW.current_publication_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM price_publications
    WHERE id = NEW.current_publication_id AND tenant_id = NEW.tenant_id
  )
BEGIN
  SELECT RAISE(ABORT, 'publication target tenant mismatch');
END;
