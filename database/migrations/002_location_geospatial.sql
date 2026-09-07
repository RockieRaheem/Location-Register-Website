CREATE TABLE IF NOT EXISTS location_geometries (
  location_uid TEXT PRIMARY KEY,
  geometry_type TEXT NOT NULL,
  geometry_json TEXT NOT NULL,
  bbox_json TEXT,
  source_name TEXT NOT NULL,
  source_version TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (location_uid) REFERENCES locations(uid) ON DELETE CASCADE,
  CHECK (json_valid(geometry_json)),
  CHECK (bbox_json IS NULL OR json_valid(bbox_json))
) STRICT;

CREATE INDEX IF NOT EXISTS location_external_ids_location_idx
  ON location_external_ids(location_uid);
