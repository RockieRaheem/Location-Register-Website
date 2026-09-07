# Location Register System Audit and Remediation Plan

## Implementation update: Firebase authentication and cloud persistence

The Firebase audit found that the application was configured for a different Google project (`gen-lang-client-0238291016`), while the requested project is `any-location-36e76`. The old checked-in applet configuration was removed. Firebase initialization now uses Vite environment variables, defaults only the non-secret project identifiers, selects the standard `(default)` Firestore database, and fails with a precise configuration error when the three required Web SDK values are absent.

The UI also contained five hard-coded test accounts, accepted any non-empty password, displayed a generated mock OTP in the page, allowed unauthenticated guest access to the dashboard, and elevated two hard-coded email addresses to administrator. Those paths have been replaced with Firebase Email/Password and Google authentication. New profiles are created as active Contributors only; administrator and country-administrator roles require trusted Admin SDK tooling. Password reset and Firebase email verification are implemented.

Firestore now has a country-neutral location representation: `countries/{ISO2}`, a per-country `hierarchyLevels` subcollection, and globally unique `locations/{UUID}` documents. A location stores its parent UUID and ordered ancestor UUIDs, permitting direct-child, level, prefix, and descendant queries without fixing the schema to Uganda. Uganda retains its six supplied administrative tiers, while every other country can define a different ordered schema. Firestore rules prevent cross-country parenting, skipped levels, falsified ancestry, self-service role elevation, and client-side subtree deletion/movement. Cloud Storage rules isolate user files and validate size and MIME type.

The trusted migration script reads the already validated SQLite registry and preserves all UUIDs, source provenance, hierarchy definitions, parent relationships, and ancestor paths. It is dry-run by default; no cloud data is written unless `--commit` is supplied. The exact registered `Any-Location` Web SDK configuration was retrieved through the authenticated Firebase CLI and stored in ignored `.env.local`. A read-only cloud check on 2026-09-07 returned HTTP 403 because the Firestore API/database has not yet been enabled. Live rules deployment and migration therefore remain pending until the owner selects the permanent Firestore region, provisions the database, and supplies Google Application Default Credentials for the import. Full procedures are in [`FIREBASE_INTEGRATION.md`](./FIREBASE_INTEGRATION.md).

## Document status

- Audit date: 2026-09-02
- Recovery commit: `df3fdea6da39135fcf7a916424ef2de8bb139de5`
- Commit author: Kamwanga Raheem
- Commit date: 2026-09-02 14:42:55 +03:00
- Commit subject: `feat(admin): expand regional data and auth access`
- Scope: Entire committed workspace, with detailed emphasis on the Uganda administrative-location hierarchy, maps, uploads, persistence, validation, and security.

## Recovery record

The working tree initially contained no checked-out project files. All 244 tracked files were staged for deletion. The application source was recovered from the commit listed above.

All Windows-compatible project files were restored. Eight archived files under `migrated_prompt_history/` could not be created because their timestamp-based filenames contain colon (`:`) characters, which are illegal in Windows filenames. These files are prompt-history archives and are not application source, configuration, map data, or runtime dependencies. Their deletions were removed from the staging area and remain visible only as unstaged Windows checkout limitations.

Before the repository is expected to be clean on Windows, those eight files should be renamed in a follow-up commit from a filesystem that can check them out, using a Windows-safe timestamp such as `2025-11-21T10-03-07.401Z.json`.

## Implementation update: Electoral Commission 2022 hierarchy

The supplied Electoral Commission dataset has now been integrated for Uganda's district/city-unit → subcounty → parish/ward → village navigation. The runtime synthetic hierarchy and generated village profiles described in this audit were removed from the active Uganda hierarchy adapter.

The normalized source copy contains 145 district/city units, 2,191 subcounties, 8,173 parishes, and 74,794 unique full village paths. Missing leadership, coordinates, population, PDM, and commercial details are left unavailable rather than generated. Full reconciliation findings, source SHA-256, explicit map aliases, reproduction commands, and remaining geometry limitations are recorded in [`ELECTORAL_COMMISSION_2022_INTEGRATION.md`](./ELECTORAL_COMMISSION_2022_INTEGRATION.md).

This completes the authoritative-name replacement for the modal's Uganda district-to-village path. It does not resolve the audit's separate persistence/editor synchronization, county-tier, authentication, upload, or geometry-provenance findings.

## Implementation update: normalized location database

The JSON-file country persistence has now been replaced by a normalized SQLite location registry. Country-specific hierarchy definitions, globally unique location UUIDs, same-country parent enforcement, closure-path traversal, source provenance, aliases, external identifiers, and audit records are implemented. Uganda's Electoral Commission records are seeded through the full Country → Region → District/City → County/Municipality/Constituency → Subcounty/Division → Parish/Ward → Village path. See [`LOCATION_DATABASE_ARCHITECTURE.md`](./LOCATION_DATABASE_ARCHITECTURE.md) for the schema, constraints, APIs, verified row counts, and operational procedures.

## Executive summary

The repository contains a visually strong prototype for navigating African countries and Uganda's administrative boundaries. Uganda has committed boundary coverage for four regions, 135 district records, and 1,520 lower-level subdivision shapes. However, the application does not yet operate as one authoritative district-to-village location register.

The principal issue is that the application has multiple independent location systems:

1. The editable and persisted `Country.adminLevels` hierarchy.
2. The static Uganda district and subdivision map hierarchy.
3. A separate deep Uganda parish/village profile registry with a runtime data generator.

These systems do not synchronize. Administrative edits and uploads do not change map content, and map-generated parish/village records are not persisted in the administrative register.

Only a small number of parish and village profiles are hand-authored. Most records shown below the sub-county level are synthesized at runtime, including leaders, phone numbers, coordinates, population, shop statistics, sales statistics, PDM records, and synchronization status. These records must not be represented as verified production data.

## Intended Uganda hierarchy

The generic model defines six administrative levels below the country:

```text
Uganda
└── Region
    └── District / City (LC5)
        └── County / Municipality (LC4)
            └── Sub-County / Town Council (LC3)
                └── Parish / Ward (LC2)
                    └── Village / Cell / Zone (LC1)
```

The map modal currently implements only five selectable tiers:

```text
Region → District → Sub-county → Parish → Village
```

The County/Municipality tier is omitted even though the repository includes ADM3 GeoJSON data and the configurable country model declares it.

## Repository architecture relevant to locations

### Application stack

- React 19 and TypeScript frontend.
- Vite development/build tooling.
- Express 5 server.
- JSON-file persistence for countries through `/api/countries`.
- Firebase/Firestore for several other application modules.
- SVG and GeoJSON boundary rendering.
- Motion/Framer Motion interactions.

### Main location components

- `components/AfricaMap.tsx`: Africa-level selection and shop plotting.
- `components/CountriesMapPage.tsx`: switches between Africa and country detail maps and opens the drill-down modal.
- `components/CountryDetailMap.tsx`: national and district boundary maps.
- `components/CountryMapModal.tsx`: region-to-village drill-down experience.
- `components/ParishAndVillageCanvas.tsx`: parish and village cards.
- `components/VillageProfileCardModal.tsx`: village details and local metrics.
- `components/CountryAdminLevelsPage.tsx`: generic hierarchy management.
- `components/CountryLocationsUploadPage.tsx`: bulk location upload and parent alignment.
- `components/AddAdminLevelModal.tsx`: individual location creation.
- `components/AddShopModal.tsx`: hierarchical shop-location selection.

### Main data and service files

- `types.ts`: generic `Country`, `AdminLevel`, office, leader, shop, and related types.
- `data.ts`: default country records and the small persisted-style Uganda hierarchy seed.
- `countryPaths.ts`: national SVG boundary paths.
- `ugandaDistrictsData.ts`: district-specific lower-level boundary paths.
- `ugandaAdminHierarchy.ts`: deep parish/village profiles and runtime generators.
- `src/services/countryService.ts`: browser REST client.
- `server.ts`: in-memory country state and JSON-file CRUD persistence.
- `uga_admin0.geojson` through `uga_admin3.geojson`: committed geographic sources.

## Inventory and measured coverage

### Committed Uganda geographic data

| Source | Feature count | Meaning in the committed data |
|---|---:|---|
| `uga_admin0.geojson` | 1 | Uganda |
| `uga_admin1.geojson` | 4 | Central, Western, Eastern, Northern |
| `uga_admin2.geojson` | 135 | District records |
| `uga_admin3.geojson` | 208 | Next administrative tier |
| `ugandaDistrictsData.ts` | 135 districts | Generated map-ready district registry |
| `ugandaDistrictsData.ts` subdivisions | 1,520 | Map-ready lower boundary shapes, 4-32 per district |

The generator in `buildUgandaDistricts.cjs` expects `uga_admin4.geojson`. That source file is not committed, even though its derived output appears to be present in `ugandaDistrictsData.ts`. This breaks data provenance and reproducibility.

### Deep parish/village profile coverage

`UGANDA_DEEP_ADMIN_DATABASE` contains:

- 5 districts: Kiryandongo, Kampala, Wakiso, Mukono, and Butambala.
- 10 hand-authored sub-counties or divisions.
- 21 hand-authored parishes or wards.
- 52 hand-authored villages, cells, zones, or related nodes.

Every other selected sub-county uses an algorithmic fallback that creates four generic parishes and four generic villages per parish.

### Generic editable Uganda register

The default `Country.adminLevels` Uganda record contains only 15 areas:

- Level 1: 4 regions.
- Level 2: 3 districts.
- Level 3: 2 areas.
- Level 4: 2 areas.
- Level 5: 2 areas.
- Level 6: 2 areas.

It is therefore not the same dataset as the 135-district map.

## Detailed findings

### F01 — Multiple unsynchronized sources of truth

Severity: Critical

The administrative editor, bulk upload workflow, visual map, and deep village profiles read from different datasets. Changes made through one workflow are not reflected in the others.

Impact:

- Uploaded villages do not appear on maps.
- Renamed districts do not update boundary labels.
- Deleted administrative locations can remain visible geographically.
- Generated village cards do not appear in administrative directories.
- Shops cannot reliably join to map nodes through stable identifiers.

Remediation:

Create one canonical normalized location repository. All maps, selectors, uploads, profiles, shops, and reports must query it. Static geometry can remain in optimized files or object storage, but every geometry must reference the same stable location ID used by the database.

### F02 — Parish and village data is mostly synthetic

Severity: Critical

For sub-counties outside the small custom registry, `getUgandaSubcountyHierarchy` generates generic names, leaders, phone numbers, PDM records, population, sales, shop density, landmarks, and coordinates. `createUgandaVillageNode` also produces randomized values.

Impact:

- Records change between sessions or re-computations.
- Invented personal and government information may be mistaken for authoritative data.
- Analytics cannot be audited.
- Users cannot distinguish sourced records from demonstrations.

Remediation:

- Remove runtime generation from production paths.
- Mark all demonstration content explicitly as synthetic in development builds.
- Add `source`, `sourceVersion`, `verificationStatus`, `verifiedAt`, and `verifiedBy` fields.
- Never display “verified” or “synced” unless supported by stored verification evidence.
- Import authoritative parish and village datasets before enabling production drill-down.

### F03 — County/Municipality is skipped in the map hierarchy

Severity: High

The configured Uganda model has six levels, but `CountryMapModal` defines only regions, districts, sub-counties, parishes, and villages. The committed ADM3 data is not incorporated into the navigation path.

Impact:

- Parentage does not reflect the configured hierarchy.
- Sub-counties cannot be reliably assigned to counties or municipalities.
- Breadcrumbs and administrative profiles are incomplete.

Remediation:

- Represent hierarchy levels as data rather than a fixed TypeScript union.
- Import and map ADM3 entities.
- Traverse using `parentLocationId` and `levelId` instead of component-specific states.
- Support country-specific level definitions without hard-coded Uganda branches.

### F04 — Invalid parent chains in default Uganda data

Severity: High

Two concrete integrity problems exist in `data.ts`:

- Goma is level 4 but points directly to Mukono at level 2.
- Kiryandongo Town Council points to parent ID 14, which is missing from the default Uganda register.

Impact:

- Ancestor traversal produces incomplete lineages.
- Child selectors and parent filters behave incorrectly.
- Profiles can show invalid hierarchy paths.

Remediation:

- Add the missing intermediate county/district records or correct the parent IDs.
- Run an import-time hierarchy validator.
- Reject any write whose parent does not exist or is not the immediately preceding administrative level.

### F05 — Main map navigation paths are inconsistent

Severity: High

Single-clicking a country opens `CountryDetailMap`; double-clicking opens `CountryMapModal`. These routes have different capabilities and data semantics.

For Uganda, `CountryDetailMap` allows district selection and displays subdivisions, but its general district subdivision shapes do not continue to parish/village navigation. The modal supports deeper navigation. The modal's initial national geometry contains district paths while its initial state labels the active tier as regions.

Impact:

- Users receive different outcomes depending on click timing.
- District shapes can be processed as region selections.
- The visible map and sidebar can represent different tiers.

Remediation:

- Use one country exploration route.
- Make single click select and a clear action open a profile, avoiding timing-based double-click semantics.
- Ensure rendered geometry is filtered to the active parent and tier.
- Route every map selection through stable location IDs.

### F06 — Missing source dataset for generated subdivision maps

Severity: High

`buildUgandaDistricts.cjs` requires `uga_admin4.geojson`, but the file is absent. The derived `ugandaDistrictsData.ts` cannot be reproduced from the committed sources.

Remediation:

- Recover and commit the licensed source, or document and automate retrieval from its authoritative provider.
- Record source attribution, license, publication date, checksum, and administrative version.
- Generate map artifacts in a reproducible build step.
- Validate generated district and child counts against the source.

### F07 — Generic location schema is too limited

Severity: High

`AdminLevel` stores numeric ID, name, level, country code, parent ID, office, and leaders. It lacks stable official codes, aliases, geometry references, centroids independent of offices, source metadata, effective dates, and verification metadata.

Impact:

- Name-based matching is unavoidable and ambiguous.
- Renames break joins.
- Official and user-created records cannot be distinguished.
- Geographic data is coupled incorrectly to office coordinates.

Remediation:

Introduce a normalized `Location` schema with UUID/internal ID, official pcode, parent ID, level ID, canonical name, aliases, centroid, geometry reference, source metadata, effective dates, and verification state.

### F08 — Bulk upload discards parsed geographic metadata

Severity: High

The upload page parses latitude, longitude, code, and population, but the final `AdminLevel` records store only ID, name, level, country code, and parent ID.

Remediation:

- Extend the canonical schema.
- Preserve every validated input field.
- Show a field-mapping step before import.
- Return a persisted import report with accepted and rejected rows.

### F09 — Bulk duplicate detection is incorrectly scoped

Severity: High

Duplicate detection compares a location name against every record at the target level in the country. The same village or parish name can legitimately exist under different parents.

Additional problems:

- Duplicates within the uploaded batch are not robustly detected.
- Editing a preview row name does not recalculate its duplicate status.
- Matching is exact name-only and does not use official codes or aliases.

Remediation:

Use a uniqueness rule such as `(countryId, parentLocationId, levelId, normalizedName)` and prefer official pcodes when supplied. Revalidate the complete batch after every preview edit and again transactionally on the server.

### F10 — CSV parsing is not standards-compliant

Severity: Medium

The implementation splits rows and columns using string delimiters. Quoted commas, escaped quotes, multiline values, BOM markers, and malformed row handling are not supported reliably.

Remediation:

Use a maintained CSV parser with explicit column mapping, row-level errors, encoding detection, maximum row limits, and downloadable rejection reports.

### F11 — Missing-parent creation can produce incorrect hierarchy

Severity: High

Missing parent areas are attached to a single default region, even when imported rows contain different region values. If automatic creation is disabled, selected warning rows may still be saved without a parent.

Remediation:

- Resolve each complete ancestor chain from the row.
- Require explicit confirmation before creating any missing ancestor.
- Reject orphan rows.
- Create ancestors and descendants in one transaction.
- Show exactly where each new ancestor will be placed.

### F12 — Client-generated numeric IDs are unsafe

Severity: High

Several workflows use `max(existing IDs) + 1` in the browser. Concurrent users can generate the same ID, and entire-country updates can overwrite each other.

Remediation:

Generate IDs on the server using UUIDs or database-native document IDs. Add revision numbers or optimistic concurrency checks. Use transactions for imports and hierarchy mutations.

### F13 — Parent deletion and editing lack integrity protections

Severity: High

The editor can remove a parent without cascading, blocking, or reassigning children. Parent-level compatibility, cycles, and country ownership are not validated.

Remediation:

- Prevent deletion while descendants exist unless a reviewed cascade is selected.
- Provide reassignment tools.
- Validate acyclic parentage.
- Enforce parent country and immediate-level compatibility server-side.
- Record audit history for structural changes.

### F14 — Country persistence is unauthenticated and unvalidated

Severity: Critical

`server.ts` exposes unrestricted REST endpoints for listing, creating, replacing, and deleting countries. No authentication, authorization, payload schema, hierarchy validation, or request ownership is enforced.

Remediation:

- Require verified authentication.
- Enforce role-based permissions server-side.
- Validate request bodies with a schema library.
- Separate operations for countries, levels, locations, and geometry rather than replacing a whole country document.
- Add rate limiting, secure headers, request logging, and structured error responses.
- Restrict CORS to approved origins.

### F15 — Persistence documentation does not match implementation

Severity: Medium

`CountriesMgtUML.md` describes Firestore persistence, while the running country service uses Express and `countries-store.json`. Firestore rules contain no `countries` collection permission, so a direct Firestore implementation would be denied by the catch-all rule.

Remediation:

Choose one production persistence architecture and update the code, UML, operational documentation, tests, and security rules together.

### F16 — Whole-country JSON storage will not scale

Severity: High

Every hierarchy edit rewrites the complete country object and all nested administrative locations to `countries-store.json`.

Impact:

- Last-write-wins data loss.
- Large payloads and slow imports.
- No efficient child queries.
- No safe partial updates.
- No durable transactional guarantees.

Remediation:

Store locations as separate indexed records in a transactional database. Query children by `(countryId, parentLocationId)` and levels by `(countryId, levelId)`.

### F17 — Random and fallback profile values conceal missing data

Severity: High

Village profile components use plausible fallback leaders, phone numbers, coordinates, shop lists, and economic statistics when fields are absent. The UI presents these values without a missing-data warning.

Remediation:

Render unknown values as “Not recorded”. Keep demo fixtures outside production data modules. Add provenance indicators to every sensitive or official field group.

### F18 — Shop-to-location relationships use copied names

Severity: High

Shop records store an array of `{level, name}` rather than stable location IDs. Name changes and duplicate place names can break association.

Remediation:

Store a terminal `locationId` and derive its ancestry. Optionally cache a display breadcrumb, but treat it as non-authoritative.

### F19 — Coordinate checks incorrectly reject zero values in some map paths

Severity: Medium

Some shop plotting checks use falsy tests such as `if (!lat || !lng)`. Valid zero latitude or longitude values are therefore excluded.

Remediation:

Check for `null`, `undefined`, finite numeric ranges, and valid latitude/longitude bounds rather than truthiness.

### F20 — Test coverage does not protect the location system

Severity: High

The committed tests focus on Firestore security rules. There are no meaningful automated tests for:

- Location hierarchy integrity.
- District and child counts.
- Map drill-down behavior.
- Upload parsing and validation.
- Duplicate detection.
- Orphan and cycle prevention.
- REST authentication and authorization.
- Persistence concurrency.

Remediation:

Add unit, integration, and end-to-end tests before migrating production data.

### F21 — Dataset currency and versioning are not managed

Severity: High

The committed Uganda GeoJSON reports `valid_on: 2020-08-24`. The application does not expose a version, effective date, supersession mechanism, or update workflow.

Remediation:

Add dataset releases and temporal validity. Never silently overwrite official boundaries; import a new version, validate it, migrate references, and activate it through a controlled release.

### F22 — Windows-incompatible repository filenames

Severity: Medium

Eight prompt-history filenames contain colons. Standard Windows Git cannot check them out.

Remediation:

Rename them using hyphens in timestamps, add a cross-platform filename rule, and include Windows checkout in CI.

## Target architecture

### Canonical data model

```text
Country
  id
  ISO codes
  name

AdministrativeLevelDefinition
  id
  countryId
  ordinal
  canonicalName
  allowedTypes

Location
  id
  countryId
  levelDefinitionId
  parentLocationId
  officialCode
  canonicalName
  normalizedName
  aliases[]
  type
  centroid
  geometryId
  sourceId
  validFrom
  validTo
  verificationStatus
  revision

LocationGeometry
  id
  locationId
  geometry or object-storage reference
  boundingBox
  simplificationLevel
  checksum

LocationSource
  id
  publisher
  datasetName
  version
  publicationDate
  license
  sourceURL
  checksum

AdministrativeProfile
  locationId
  office
  leaders[]
  field-level provenance

Shop
  locationId
  coordinates
```

### Query flow

```text
Map or selector
  → request children of a stable parent ID
  → receive canonical locations and geometry references
  → select one location ID
  → repeat until the terminal level
  → request verified profile and linked shops
```

## Implementation plan

### Phase 0 — Preserve and baseline the recovered project

1. Rename the eight Windows-incompatible history files.
2. Install dependencies from the lockfile.
3. Run TypeScript, build, and existing tests.
4. Capture all existing failures without mixing them with location changes.
5. Create a recovery tag or branch for commit `df3fdea`.

Exit criteria:

- Clean cross-platform checkout.
- Reproducible install and build.
- Baseline test report.

### Phase 1 — Introduce schema and integrity validation

1. Add canonical location and level-definition types.
2. Add stable IDs and official codes.
3. Implement reusable hierarchy validation:
   - parent exists;
   - same country;
   - immediately preceding level;
   - no cycles;
   - uniqueness within parent;
   - valid coordinates;
   - source and verification requirements.
4. Add tests for all invariants.

Exit criteria:

- Invalid Goma and Kiryandongo chains are detected automatically.
- No new orphan or cyclic records can be created.

### Phase 2 — Establish authoritative persistence and security

1. Select the production database.
2. Add authenticated server middleware.
3. Implement role-based permissions.
4. Add normalized location CRUD endpoints.
5. Add transactional bulk import and optimistic concurrency.
6. Remove whole-country replacement for hierarchy changes.
7. Add audit events for create, update, move, verify, supersede, and delete.

Exit criteria:

- Unauthorized writes are rejected.
- Concurrent edits cannot silently overwrite each other.
- Imports are atomic and auditable.

### Phase 3 — Build a reproducible Uganda data pipeline

1. Recover/document the ADM4 source.
2. Obtain authoritative county, sub-county, parish, and village datasets with licensing approval.
3. Validate pcodes, parent codes, names, geometries, and counts.
4. Generate simplified web geometry from canonical source data.
5. Store source/version/checksum metadata.
6. Produce import and discrepancy reports.

Exit criteria:

- Every displayed location traces to a source record.
- Generated artifacts can be reproduced from committed or documented inputs.
- No production profile relies on `Math.random()`.

### Phase 4 — Migrate and unify the frontend

1. Replace hard-coded hierarchy states with level-definition-driven navigation.
2. Merge `CountryDetailMap` and `CountryMapModal` behavior into one explorer.
3. Render only children of the selected canonical parent.
4. Add the County/Municipality tier.
5. Make breadcrumbs ID-based.
6. Connect profiles and shop markers to location IDs.
7. Display provenance and verification status.
8. Show honest missing-data states.

Exit criteria:

- Region-to-village traversal uses one data source.
- An admin edit is reflected in lists, selectors, profiles, and maps.
- Single-click and double-click no longer lead to conflicting applications.

### Phase 5 — Replace the upload workflow

1. Use a standards-compliant CSV parser.
2. Add explicit column mapping.
3. Preserve coordinates, codes, population, aliases, and source fields.
4. Resolve complete ancestor chains.
5. Detect duplicates within the correct parent scope.
6. Validate on both client and server.
7. Add dry-run imports and downloadable rejection reports.
8. Commit accepted rows transactionally.

Exit criteria:

- No selected row can create an orphan.
- Imported metadata is not discarded.
- Re-running the same import is idempotent.

### Phase 6 — Verification, rollout, and monitoring

1. Compare imported counts against source datasets at every level.
2. Add hierarchy health dashboards.
3. Add end-to-end tests for representative urban and rural paths.
4. Test large imports and concurrent administration.
5. Introduce staged dataset activation and rollback.
6. Monitor missing parents, duplicate codes, invalid geometry, and stale verification.

Exit criteria:

- Automated integrity checks pass before release.
- Dataset releases are versioned and reversible.
- Operational monitoring detects hierarchy corruption.

## Priority order

### Immediate

1. Preserve the recovered commit and fix Windows-incompatible filenames.
2. Stop presenting generated records as verified or synced.
3. Add hierarchy validators and repair the two known broken parent chains.
4. Protect country/location REST writes with authentication and authorization.

### Next

1. Create the canonical location schema and normalized persistence.
2. Recover the missing source dataset and establish provenance.
3. Migrate the Uganda hierarchy into the canonical repository.
4. Connect the map and administration screens to the same data.

### Later

1. Complete authoritative parish/village coverage.
2. Migrate shops and profiles to stable location IDs.
3. Add dataset versioning, monitoring, and controlled releases.
4. Generalize the pipeline for other countries.

## Required test suite

### Unit tests

- Level and parent validation.
- Cycle detection.
- Parent-scoped name normalization and duplicate detection.
- Official-code uniqueness.
- Coordinate range validation.
- CSV parsing and field mapping.
- Source and verification rules.

### Integration tests

- Authenticated location CRUD.
- Concurrent update conflict handling.
- Atomic imports and rollback.
- Geometry-to-location joins.
- Shop-to-location joins.
- Dataset version activation.

### End-to-end tests

- Uganda → Region → District → County → Sub-county → Parish → Village.
- Urban Division → Ward → Cell navigation.
- Rural County → Sub-county → Parish → Village navigation.
- Administrative edit reflected on the map.
- Upload followed by search, map navigation, and shop assignment.
- Permission checks for viewer, administrator, and super-user roles.

## Definition of done

The location system will be considered production-ready when:

- There is one canonical hierarchy source.
- Every location has a stable ID and valid parent chain.
- Map geometry and administrative records reference the same IDs.
- Every official-looking field has provenance and verification state.
- Synthetic demo records are absent from production paths.
- All writes are authenticated, authorized, validated, transactional, and audited.
- Uploads preserve data and cannot create orphans.
- District-to-village traversal is complete for the activated dataset version.
- Automated integrity, security, integration, and end-to-end tests pass.
- The repository checks out, installs, builds, and tests successfully on Windows and Linux.
