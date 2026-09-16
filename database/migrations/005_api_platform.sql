CREATE TABLE IF NOT EXISTS api_clients (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  assigned_country_codes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assigned_country_codes_json)),
  assigned_location_reference_codes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assigned_location_reference_codes_json)),
  requests_per_minute INTEGER NOT NULL DEFAULT 60 CHECK (requests_per_minute BETWEEN 1 AND 10000),
  daily_quota INTEGER NOT NULL DEFAULT 10000 CHECK (daily_quota BETWEEN 1 AND 10000000),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS api_credentials (
  uid TEXT PRIMARY KEY,
  client_uid TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  scopes_json TEXT NOT NULL CHECK (json_valid(scopes_json)),
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (client_uid) REFERENCES api_clients(uid) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS api_usage_daily (
  client_uid TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_uid, usage_date),
  FOREIGN KEY (client_uid) REFERENCES api_clients(uid) ON DELETE CASCADE
) WITHOUT ROWID, STRICT;

CREATE TABLE IF NOT EXISTS api_idempotency_records (
  principal_uid TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  request_path TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_json TEXT CHECK (response_json IS NULL OR json_valid(response_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (principal_uid, idempotency_key)
) WITHOUT ROWID, STRICT;

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  uid TEXT PRIMARY KEY,
  client_uid TEXT NOT NULL,
  url TEXT NOT NULL,
  events_json TEXT NOT NULL CHECK (json_valid(events_json)),
  signing_secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (client_uid) REFERENCES api_clients(uid) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  uid TEXT PRIMARY KEY,
  subscription_uid TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  response_status INTEGER,
  error_message TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (subscription_uid) REFERENCES webhook_subscriptions(uid) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS location_dataset_editions (
  uid TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  edition TEXT NOT NULL,
  title TEXT NOT NULL,
  authority TEXT NOT NULL,
  effective_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('candidate', 'published', 'superseded')),
  source_sha256 TEXT NOT NULL,
  statistics_json TEXT NOT NULL CHECK (json_valid(statistics_json)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (country_code, edition, source_sha256)
) STRICT;

CREATE INDEX IF NOT EXISTS api_credentials_client_idx ON api_credentials(client_uid, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS webhook_subscriptions_client_idx ON webhook_subscriptions(client_uid, status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_idx ON webhook_deliveries(event_id, created_at);
