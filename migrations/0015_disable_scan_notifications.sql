-- Only an explicitly submitted contact request may notify ops about a check.
-- Keep this narrow guard during rollout/rollback of older Pages/Worker builds.
CREATE TRIGGER suppress_checker_attention_mail
BEFORE INSERT ON lifecycle_events
WHEN NEW.event_type = 'inquiry_checker_attention'
BEGIN
  SELECT RAISE(IGNORE);
END;

UPDATE lifecycle_deliveries SET status='failed',error='scan_notification_disabled'
WHERE status='pending' AND event_id IN (
  SELECT id FROM lifecycle_events WHERE event_type='inquiry_checker_attention'
);
UPDATE lifecycle_events SET status='cancelled',lease_token=NULL,lease_until=NULL
WHERE event_type='inquiry_checker_attention' AND status NOT IN ('completed','cancelled');
