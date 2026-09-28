-- Run after 0001_initial.sql, only on a newly authorized empty production D1.
-- No guest entries, test passes, staff identities or holiday-hour windows seeded.
-- A staging database must never be promoted or copied into production.
CREATE TABLE production_environment (
  id INTEGER PRIMARY KEY CHECK(id=1),
  identifier TEXT NOT NULL CHECK(identifier='sb-nye-2027-production')
);
-- CHECK rejects marking a populated or staging database as production. Failure
-- leaves no valid marker and the Worker fails closed; no rows are deleted.
INSERT INTO production_environment(id,identifier)
SELECT 1, CASE WHEN
  NOT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='staging_environment')
  AND NOT EXISTS(SELECT 1 FROM sessions)
  AND NOT EXISTS(SELECT 1 FROM entries)
  AND NOT EXISTS(SELECT 1 FROM presence)
  AND NOT EXISTS(SELECT 1 FROM passes)
  AND NOT EXISTS(SELECT 1 FROM redemption_audit)
  AND NOT EXISTS(SELECT 1 FROM staff_users)
  AND NOT EXISTS(SELECT 1 FROM staff_locations)
  AND NOT EXISTS(SELECT 1 FROM redemption_windows)
  AND NOT EXISTS(SELECT 1 FROM rate_limits)
THEN 'sb-nye-2027-production' ELSE 'REFUSED_NONEMPTY_OR_STAGING_DATABASE' END;
