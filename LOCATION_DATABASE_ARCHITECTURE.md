# Scalable African location database architecture

## Implemented outcome

The project now persists countries, country-specific hierarchy definitions, and administrative locations in SQLite instead of treating a complete `Country` JSON object as the database. The database is generated at `data/location-register.sqlite`; it is ignored by Git because database files and their WAL sidecars are runtime state. The schema, migrations, seeders, and validators are committed and reproducible.

The implementation requires Node.js 22.13 or newer and uses the built-in `node:sqlite` driver. No native third-party database package is required.

## Why the model is not Uganda-specific

Each country owns an ordered list of hierarchy definitions in `hierarchy_levels`. A location references one of those definitions rather than a global `district`, `county`, or `village` column.

Examples currently configured from project data:

| Country | Configured hierarchy |
|---|---|
| Uganda | Region → District/City → County/Municipality/Constituency → Sub-County/Division/Town Council → Parish/Ward → Village/Cell/Zone |
| Kenya | County |
| Tanzania | Zone |
| Rwanda | Province |
| Nigeria | Level 1 → Level 2 (the project has not supplied authoritative names) |
| South Africa | Level 1 → Level 2 (the project has not supplied authoritative names) |

Adding a country does not require a database migration. Its hierarchy is data: insert the country and its ordered level definitions, then insert location nodes against those levels.

## Canonical identifiers

Every country, hierarchy level, and location has a UUID stored as `TEXT`:

- `countries.uid`: globally unique country identifier.
- `countries.root_location_uid`: UUID of that country's root `Country` node.
- `hierarchy_levels.uid`: globally unique hierarchy-definition identifier.
- `locations.uid`: globally unique identifier for a region, district, county, subcounty, parish, village, or any country-specific equivalent.
- `locations.parent_uid`: canonical parent UUID.

Imported Electoral Commission records use deterministic UUIDv5 identifiers based on country code and their complete canonical path. Re-importing the same source therefore produces the same identifiers. New API-created locations use cryptographically random UUIDs.

The old numeric `AdminLevel.id` remains only as a compatibility field for existing screens. New integrations must reference `uid` and `parentUid`.

## Tables

### `countries`

Stores country identity, ISO alpha-2 code, the root location UUID, profile JSON, and hierarchy version. The profile JSON contains non-hierarchy settings such as currency and VAT; locations are not embedded in it.

### `hierarchy_levels`

Defines an ordered schema per country:

- stable machine key;
- display name;
- alternate names;
- allowed unit types;
- level order;
- required/optional status.

Display labels can evolve without changing location UUIDs or application references.

### `locations`

Stores every canonical node using the adjacency-list pattern:

- country and hierarchy-level UUID;
- parent UUID;
- depth;
- exact source/display name;
- normalized search name;
- type, lifecycle status, provenance, and extensible metadata.

The database preserves punctuation-distinct source names. For example, `KATONGO - TUT` and `KATONGO TUT` remain separate villages even though their broad search normalization is the same.

### `location_paths`

Closure-table index containing every ancestor/descendant relationship. It supports efficient queries such as:

- all villages below a district;
- complete lineage for a village;
- subtree counts at any depth;
- authorization scopes covering all descendants of a location UUID.

Insertion triggers maintain closure paths automatically. Move operations update the affected cross-tree paths transactionally.

### `location_aliases`

Stores alternative spellings and cross-dataset labels without changing canonical names. Current explicit aliases are `Luwero` → `LUWEERO` and Kampala geometry's `Central Division` → `KAMPALA CENTRAL`.

### `location_external_ids`

Supports identifiers assigned by electoral commissions, national statistical offices, postal systems, map providers, or other authorities. External identifiers do not replace the internal UUID.

### `location_audit_log`

Records imports, creates, updates, moves, and deletes with actor and before/after payloads.

## Enforced integrity rules

SQLite constraints and triggers enforce the following independently of the frontend:

1. ISO country codes are unique uppercase alpha-2 codes.
2. Each country has exactly one root `Country` node.
3. Each level order and machine key is unique within its country.
4. A location's level must belong to its country and match its depth.
5. A location's parent must belong to the same country and be exactly one level above it.
6. Exact case-insensitive sibling names cannot duplicate beneath the same parent.
7. Foreign keys prevent orphan nodes.
8. Non-cascade deletion is rejected for locations with children.
9. Moves across countries, skipped hierarchy levels, and cycles are rejected.
10. Country-managed compatibility nodes cannot be rebuilt if externally managed descendants are attached.

## Uganda Electoral Commission import

The seed maps the supplied hierarchy into the configured Uganda model:

```text
Country
└── Region
    └── District / City
        └── County / Municipality / Constituency
            └── Sub-County / Division / Town Council
                └── Parish / Ward
                    └── Village / Cell / Zone
```

The Electoral Commission's `constituency` field supplies level 3. It produces 347 distinct level-3 nodes under their districts. Region assignments come from the existing Uganda district boundary registry. Units without a defensible region match are placed under the explicit `Region not provided by source` bucket rather than guessed.

Current Uganda database totals:

| Depth | Level | Rows |
|---:|---|---:|
| 0 | Country | 1 |
| 1 | Region/source-unavailable bucket | 5 |
| 2 | District/City unit | 145 |
| 3 | County/Municipality/Constituency | 347 |
| 4 | Subcounty/Division/Town Council | 2,191 |
| 5 | Parish/Ward | 8,173 |
| 6 | Village/Cell/Zone | 74,794 |

Source provenance and exact source paths are stored on every imported node. Unsupported leadership, population, coordinates, PDM, and commercial facts are not generated.

## HTTP API

The canonical API is under `/api/location-registry`:

- `GET /statistics?countryCode=UG`
- `GET /countries/:countryCode/schema`
- `PUT /countries/:countryCode/schema`
- `GET /countries/:countryCode/locations?parentUid=&level=&search=&limit=&offset=`
- `GET /locations/:uid`
- `GET /locations/:uid/ancestors`
- `GET /locations/:uid/descendants?maxDepth=&limit=&offset=`
- `POST /locations`
- `PATCH /locations/:uid`
- `POST /locations/:uid/move`
- `DELETE /locations/:uid?cascade=false`

List and descendant endpoints are paginated and capped at 1,000 rows per request. API mutations can provide an `x-actor-id` header for the audit log.

The original `/api/countries` endpoints remain available. They now persist through SQLite and project canonical UUIDs into `Country.uid`, `Country.rootLocationUid`, `AdminLevel.uid`, and `AdminLevel.parentUid` for compatibility with existing React screens.

## Reproduction and verification

```powershell
npm run db:seed -- --reset
npm run db:validate
npm run dev
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-location-api.ps1
npm run lint
npm run build
```

`db:validate` checks SQLite integrity, foreign keys, hierarchy definitions, every Uganda depth count, all closure-path cardinalities, parent depth/country consistency, source row totals, aliases, and preservation of punctuation-distinct villages.

When the server starts against an empty database, it migrates `countries-store.json` if present; otherwise it initializes configured country profiles from `data.ts`. Run the full seed command to import the Electoral Commission hierarchy.

## Production operations

- Back up the database using SQLite's online backup mechanism or a filesystem snapshot coordinated with WAL checkpointing.
- Keep `data/location-register.sqlite`, `-wal`, and `-shm` files on persistent storage.
- Run migrations before accepting traffic during deployment.
- Use one writer process or add an application-level write queue if deployment grows beyond a single Node process.
- For multi-region/high-write deployment, retain the logical schema but migrate to PostgreSQL; UUIDs, adjacency relationships, closure paths, and API contracts can remain unchanged.
