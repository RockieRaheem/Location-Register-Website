# Data directories

- `sources/` contains immutable external source datasets, grouped by country.
- `database/` contains the ignored local SQLite database and its sidecars.
- `reports/` contains generated validation and import reports.
- `geospatial/` contains map source and generated geometry assets.

Uganda support-data provenance and matching policy are documented in `docs/data/uganda-support-integration.md`.

Do not manually edit generated reports or SQLite files. Preserve source provenance when adding or replacing an external dataset.
