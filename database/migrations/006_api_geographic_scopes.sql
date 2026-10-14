ALTER TABLE api_clients ADD COLUMN assigned_economic_zones_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assigned_economic_zones_json));
ALTER TABLE api_clients ADD COLUMN assigned_regional_blocks_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(assigned_regional_blocks_json));
