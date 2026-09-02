PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS countries (
  uid TEXT PRIMARY KEY,
  legacy_id INTEGER NOT NULL UNIQUE,
  iso2 TEXT NOT NULL UNIQUE CHECK (length(iso2) = 2 AND iso2 = upper(iso2)),
  name TEXT NOT NULL,
  root_location_uid TEXT UNIQUE,
  profile_json TEXT NOT NULL DEFAULT '{}',
  hierarchy_version INTEGER NOT NULL DEFAULT 1 CHECK (hierarchy_version > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (json_valid(profile_json))
) STRICT;

CREATE TABLE IF NOT EXISTS hierarchy_levels (
  uid TEXT PRIMARY KEY,
  country_uid TEXT NOT NULL,
  level_order INTEGER NOT NULL CHECK (level_order > 0),
  level_key TEXT NOT NULL CHECK (length(trim(level_key)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  alternate_names_json TEXT NOT NULL DEFAULT '[]',
  allowed_types_json TEXT NOT NULL DEFAULT '[]',
  is_required INTEGER NOT NULL DEFAULT 1 CHECK (is_required IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (country_uid) REFERENCES countries(uid) ON DELETE CASCADE,
  UNIQUE (country_uid, level_order),
  UNIQUE (country_uid, level_key),
  UNIQUE (uid, country_uid),
  CHECK (json_valid(alternate_names_json) AND json_type(alternate_names_json) = 'array'),
  CHECK (json_valid(allowed_types_json) AND json_type(allowed_types_json) = 'array')
) STRICT;

CREATE TABLE IF NOT EXISTS locations (
  uid TEXT PRIMARY KEY,
  country_uid TEXT NOT NULL,
  level_uid TEXT,
  parent_uid TEXT,
  legacy_id INTEGER,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  normalized_name TEXT NOT NULL CHECK (length(normalized_name) > 0),
  type_label TEXT NOT NULL CHECK (length(trim(type_label)) > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'historical')),
  source_name TEXT,
  source_year INTEGER,
  source_path TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (country_uid) REFERENCES countries(uid) ON DELETE CASCADE,
  FOREIGN KEY (level_uid, country_uid) REFERENCES hierarchy_levels(uid, country_uid),
  FOREIGN KEY (parent_uid, country_uid) REFERENCES locations(uid, country_uid) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (uid, country_uid),
  UNIQUE (country_uid, legacy_id),
  CHECK (json_valid(metadata_json)),
  CHECK (
    (depth = 0 AND level_uid IS NULL AND parent_uid IS NULL AND type_label = 'Country') OR
    (depth > 0 AND level_uid IS NOT NULL AND parent_uid IS NOT NULL)
  )
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS locations_one_root_per_country
  ON locations(country_uid) WHERE depth = 0;

CREATE UNIQUE INDEX IF NOT EXISTS locations_unique_sibling_name
  ON locations(country_uid, parent_uid, level_uid, name COLLATE NOCASE)
  WHERE parent_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS locations_parent_idx ON locations(parent_uid, name);
CREATE INDEX IF NOT EXISTS locations_country_level_idx ON locations(country_uid, level_uid, name);
CREATE INDEX IF NOT EXISTS locations_country_normalized_name_idx ON locations(country_uid, normalized_name);

CREATE TABLE IF NOT EXISTS location_paths (
  country_uid TEXT NOT NULL,
  ancestor_uid TEXT NOT NULL,
  descendant_uid TEXT NOT NULL,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_uid, descendant_uid),
  FOREIGN KEY (ancestor_uid, country_uid) REFERENCES locations(uid, country_uid) ON DELETE CASCADE,
  FOREIGN KEY (descendant_uid, country_uid) REFERENCES locations(uid, country_uid) ON DELETE CASCADE
) WITHOUT ROWID, STRICT;

CREATE INDEX IF NOT EXISTS location_paths_descendant_idx
  ON location_paths(descendant_uid, depth, ancestor_uid);
CREATE INDEX IF NOT EXISTS location_paths_country_depth_idx
  ON location_paths(country_uid, depth);

CREATE TABLE IF NOT EXISTS location_aliases (
  uid TEXT PRIMARY KEY,
  location_uid TEXT NOT NULL,
  alias TEXT NOT NULL CHECK (length(trim(alias)) > 0),
  normalized_alias TEXT NOT NULL CHECK (length(normalized_alias) > 0),
  locale TEXT,
  source_name TEXT,
  FOREIGN KEY (location_uid) REFERENCES locations(uid) ON DELETE CASCADE,
  UNIQUE (location_uid, normalized_alias, locale)
) STRICT;

CREATE INDEX IF NOT EXISTS location_aliases_lookup_idx ON location_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS location_external_ids (
  location_uid TEXT NOT NULL,
  authority TEXT NOT NULL,
  external_id TEXT NOT NULL,
  source_version TEXT,
  PRIMARY KEY (authority, external_id, source_version),
  FOREIGN KEY (location_uid) REFERENCES locations(uid) ON DELETE CASCADE
) WITHOUT ROWID, STRICT;

CREATE TABLE IF NOT EXISTS location_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_uid TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'move', 'delete', 'import')),
  actor TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (before_json IS NULL OR json_valid(before_json)),
  CHECK (after_json IS NULL OR json_valid(after_json))
) STRICT;

CREATE TRIGGER IF NOT EXISTS locations_validate_level_insert
BEFORE INSERT ON locations
WHEN NEW.depth > 0
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM hierarchy_levels level
    WHERE level.uid = NEW.level_uid
      AND level.country_uid = NEW.country_uid
      AND level.level_order = NEW.depth
  ) THEN RAISE(ABORT, 'location level does not match its depth or country') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM locations parent
    WHERE parent.uid = NEW.parent_uid
      AND parent.country_uid = NEW.country_uid
      AND parent.depth = NEW.depth - 1
  ) THEN RAISE(ABORT, 'location parent must belong to the same country and preceding level') END;
END;

CREATE TRIGGER IF NOT EXISTS locations_validate_level_update
BEFORE UPDATE OF country_uid, level_uid, parent_uid, depth ON locations
WHEN NEW.depth > 0
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM hierarchy_levels level
    WHERE level.uid = NEW.level_uid
      AND level.country_uid = NEW.country_uid
      AND level.level_order = NEW.depth
  ) THEN RAISE(ABORT, 'location level does not match its depth or country') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM locations parent
    WHERE parent.uid = NEW.parent_uid
      AND parent.country_uid = NEW.country_uid
      AND parent.depth = NEW.depth - 1
  ) THEN RAISE(ABORT, 'location parent must belong to the same country and preceding level') END;
END;

CREATE TRIGGER IF NOT EXISTS locations_paths_insert
AFTER INSERT ON locations
BEGIN
  INSERT INTO location_paths(country_uid, ancestor_uid, descendant_uid, depth)
  VALUES (NEW.country_uid, NEW.uid, NEW.uid, 0);

  INSERT INTO location_paths(country_uid, ancestor_uid, descendant_uid, depth)
  SELECT NEW.country_uid, ancestor_uid, NEW.uid, depth + 1
  FROM location_paths
  WHERE descendant_uid = NEW.parent_uid;
END;

CREATE TRIGGER IF NOT EXISTS countries_validate_root_update
BEFORE UPDATE OF root_location_uid ON countries
WHEN NEW.root_location_uid IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM locations root
    WHERE root.uid = NEW.root_location_uid
      AND root.country_uid = NEW.uid
      AND root.depth = 0
  ) THEN RAISE(ABORT, 'country root_location_uid must reference its own root location') END;
END;
