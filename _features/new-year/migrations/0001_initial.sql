-- V2 FRESH DATABASE SCHEMA. Not an in-place migration from the unshipped v1 lab.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
  created_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY, campaign TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  first_name TEXT NOT NULL CHECK(length(first_name) BETWEEN 1 AND 40),
  registered_ms INTEGER NOT NULL, pre_ms INTEGER, pre_observed_ms INTEGER, post_ms INTEGER, eligible_ms INTEGER,
  UNIQUE(campaign, session_id)
);
CREATE TABLE IF NOT EXISTS presence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES entries(id),
  received_ms INTEGER NOT NULL, visible INTEGER NOT NULL CHECK(visible IN (0,1))
);
CREATE INDEX IF NOT EXISTS presence_entry_time ON presence(entry_id, received_ms);
CREATE TABLE IF NOT EXISTS passes (
  id TEXT PRIMARY KEY, campaign TEXT NOT NULL,
  entry_id TEXT NOT NULL UNIQUE REFERENCES entries(id),
  short_code TEXT NOT NULL CHECK(length(short_code)=5 AND short_code NOT GLOB '*[^0-9]*' AND substr(short_code,1,1)<>'0'),
  issued_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL,
  redeemed_ms INTEGER, redeemed_location TEXT, redeemed_by TEXT, redemption_key TEXT,
  UNIQUE(campaign, short_code),
  CHECK((redeemed_ms IS NULL AND redeemed_location IS NULL AND redeemed_by IS NULL AND redemption_key IS NULL)
    OR (redeemed_ms IS NOT NULL AND redeemed_location IS NOT NULL AND redeemed_by IS NOT NULL AND redemption_key IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS staff_users (
  subject TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS staff_locations (
  subject TEXT NOT NULL REFERENCES staff_users(subject),
  location TEXT NOT NULL CHECK(location IN ('fort-worth','willow-bend')),
  PRIMARY KEY(subject, location)
);
-- Intentionally EMPTY. Actual Jan 1-3 holiday hours must be entered before launch.
-- UTC windows are half-open [opens_ms, closes_ms). No window means no redemption.
CREATE TABLE IF NOT EXISTS redemption_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL CHECK(location IN ('fort-worth','willow-bend')),
  opens_ms INTEGER NOT NULL, closes_ms INTEGER NOT NULL,
  label TEXT NOT NULL, CHECK(opens_ms < closes_ms), UNIQUE(location, opens_ms)
);
CREATE TABLE IF NOT EXISTS redemption_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, pass_id TEXT NOT NULL UNIQUE,
  redeemed_ms INTEGER NOT NULL, location TEXT NOT NULL,
  staff_subject TEXT NOT NULL, request_id TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS redemption_audit_insert
AFTER UPDATE OF redeemed_ms ON passes
WHEN OLD.redeemed_ms IS NULL AND NEW.redeemed_ms IS NOT NULL
BEGIN
  INSERT INTO redemption_audit(pass_id,redeemed_ms,location,staff_subject,request_id)
    VALUES(NEW.id,NEW.redeemed_ms,NEW.redeemed_location,NEW.redeemed_by,NEW.redemption_key);
END;
CREATE TRIGGER IF NOT EXISTS redemption_irreversible
BEFORE UPDATE ON passes WHEN OLD.redeemed_ms IS NOT NULL
BEGIN SELECT RAISE(ABORT,'Redemption is final; do not modify a redeemed pass'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON redemption_audit
BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON redemption_audit
BEGIN SELECT RAISE(ABORT,'Append-only audit'); END;
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_ms INTEGER NOT NULL
);
