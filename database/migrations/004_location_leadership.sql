CREATE TABLE IF NOT EXISTS location_leader_assignments (
  uid TEXT PRIMARY KEY,
  location_uid TEXT NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  organization TEXT,
  biography TEXT,
  term_started_on TEXT,
  term_ended_on TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by_uid TEXT NOT NULL,
  created_by_email TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by_uid TEXT NOT NULL,
  updated_by_email TEXT,
  FOREIGN KEY (location_uid) REFERENCES locations(uid) ON DELETE CASCADE,
  CHECK (term_started_on IS NULL OR date(term_started_on) IS NOT NULL),
  CHECK (term_ended_on IS NULL OR date(term_ended_on) IS NOT NULL),
  CHECK (term_started_on IS NULL OR term_ended_on IS NULL OR term_ended_on >= term_started_on)
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS location_one_current_leader_idx
ON location_leader_assignments(location_uid) WHERE is_current = 1;

CREATE INDEX IF NOT EXISTS location_leader_history_idx
ON location_leader_assignments(location_uid, is_current DESC, term_started_on DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS location_leadership_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_uid TEXT,
  location_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'replace', 'end')),
  actor_uid TEXT NOT NULL,
  actor_email TEXT,
  actor_role TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (location_uid) REFERENCES locations(uid) ON DELETE CASCADE,
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json))
) STRICT;

CREATE INDEX IF NOT EXISTS location_leadership_audit_location_idx
ON location_leadership_audit_log(location_uid, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS location_leadership_audit_immutable_update
BEFORE UPDATE ON location_leadership_audit_log
BEGIN
  SELECT RAISE(ABORT, 'leadership audit records are immutable');
END;

CREATE TRIGGER IF NOT EXISTS location_leadership_audit_immutable_delete
BEFORE DELETE ON location_leadership_audit_log
BEGIN
  SELECT RAISE(ABORT, 'leadership audit records are immutable');
END;
