# Uganda support-data integration

## Decision

The added support material contains two useful datasets with different responsibilities:

- Uganda administrative GeoJSON version `v01`, valid from 24 August 2020, supplies boundaries, centroids, areas, and pcodes for administrative levels 0 through 4.
- The MIT-licensed Geosanga repository supplies linked numeric identifiers for 135 districts, 303 counties, 2,120 subcounties, 10,365 parishes, and 71,250 villages.

Neither source replaces the Electoral Commission 2022 hierarchy. The EC dataset remains authoritative for selectable names and parent paths because it is newer and contains 145 district/city units and 74,794 unique village paths.

## Integration behavior

`npm run db:enrich:uganda-geodata` matches geometry conservatively by normalized country, district, and location names. It stores matched boundaries in `location_geometries`, stores `UG_ADMIN_PCODE` values in `location_external_ids`, and adds source-provided centroids and areas to location metadata. Ambiguous or unmatched records are reported instead of guessed.

Geometry is available from `GET /api/location-registry/locations/:uid/geometry`. It remains in local SQLite and is not bulk-uploaded to Firestore, avoiding unnecessary Spark-plan storage and document-read costs.

The initial deterministic enrichment matches 1,468 of 1,868 boundary features. The remaining 400 reflect spelling changes, renamed districts, electoral/administrative hierarchy differences, or ambiguous repeated names. They are preserved in the source files for future reviewed crosswalks.

## Provenance and validation

- GeoJSON inputs: `data/geospatial/uganda/uga_admin0.geojson` through `uga_admin4.geojson`, plus 1,868 independently validated administrative points.
- Secondary hierarchy: `data/sources/uganda/geosanga/` with its original README and MIT license.
- Enrichment report: `data/reports/uganda-geodata-enrichment.json`.
- `npm run validate:uganda-support` verifies unique identifiers, complete parent references, and valid GeoJSON collections.
- `npm run db:validate` verifies SQLite integrity and reports geometry/external-ID totals.

The duplicate support copies of `admin0` through `admin3`, derived boundary lines, and the legacy PHP API are not application dependencies.
