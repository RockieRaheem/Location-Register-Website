ALTER TABLE locations ADD COLUMN reference_code TEXT;

UPDATE locations
SET reference_code = (
  SELECT country.iso2 || '-L' || printf('%02d', locations.depth) || '-' || upper(replace(locations.uid, '-', ''))
  FROM countries country
  WHERE country.uid = locations.country_uid
)
WHERE reference_code IS NULL;

CREATE UNIQUE INDEX locations_reference_code_unique
  ON locations(reference_code);

CREATE TRIGGER locations_reference_code_required_insert
BEFORE INSERT ON locations
WHEN NEW.reference_code IS NULL OR length(trim(NEW.reference_code)) = 0
BEGIN
  SELECT RAISE(ABORT, 'location reference code is required');
END;

CREATE TRIGGER locations_reference_code_immutable
BEFORE UPDATE OF reference_code ON locations
WHEN NEW.reference_code IS NOT OLD.reference_code
BEGIN
  SELECT RAISE(ABORT, 'location reference code is immutable');
END;
