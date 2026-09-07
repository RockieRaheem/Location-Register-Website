# Uganda Electoral Commission 2022 hierarchy integration

## Outcome

The application now uses the supplied `electoral-commission-2022.json` as the authoritative source for Uganda's selectable district/city → subcounty → parish/ward → village hierarchy. Display names remain exactly as written in that source. The imported project copy is `data/uganda-electoral-commission-2022.json`.

The source document was treated only as data. It contains no executable or project instructions.

## Source identity and verified totals

- Source file: `electoral-commission-2022.json`
- Size: 17,538,204 bytes
- SHA-256: `92a02d4c9fcafac3e5ba106a0b03e29c8ad154ec8f63e2c1129f1c01d2cf5ac7`
- District/city units: 145 (135 names without a `CITY` suffix and 10 with it; this classification is derived from the supplied names)
- Subcounties/divisions/town councils: 2,191
- Parishes/wards: 8,173
- Unique full village paths: 74,794
- Globally unique village names: 55,157

Village names cannot safely be treated as globally unique. The integration identifies a village by its full parent path.

## Critical source findings

The JSON contains four indexes: `districts`, `byVillage`, `byParish`, and `bySubcounty`. They are not equivalent representations:

- `byVillage` is keyed only by village name and therefore cannot preserve different villages with the same name under different parents.
- `bySubcounty` contains 76,385 village references. It repeats 1,059 parish segments and 2,050 exact district/subcounty/parish/village paths.
- `byParish` contains 64,298 village references and contributes 61 parish paths and 459 village paths absent from `bySubcounty`.
- `number_of_subcounties` is inconsistent with the contained data in 1,944 of 2,191 subcounty records. Its values often behave more like counts of village references, so the importer does not use it.

The importer therefore takes a lossless union of the district-scoped `bySubcounty` and `byParish` indexes. It removes only exact duplicate full paths. It does not use fuzzy matching or silently merge similarly spelled places.

## Map-data boundary

The existing project geometry has 135 district map entries and 1,520 subdivision shapes. The Electoral Commission source has 145 district/city units and 2,191 subcounty-level units, so geometry does not exist for every source entity.

- All source entities remain accessible through the hierarchy lists and search.
- A boundary is drawn only where the existing map data has an exact normalized name match.
- `Luwero` (map) → `LUWEERO` (source) is an explicit district spelling alias.
- `Central Division` (Kampala geometry) → `KAMPALA CENTRAL` (source) is an explicit subcounty-level label alias.
- No alias is made between `TEREGO` and the map entry `Madi Okollo`; they are distinct places.
- An entity without matching geometry is shown as source hierarchy data without invented coordinates or boundaries.

## Application changes

- Uganda's country detail and hierarchy modal now expose every imported district/city and source subcounty.
- Selecting a source subcounty loads its real parishes and villages.
- Search was added to large hierarchy lists.
- Source paths and source identity are displayed in parish/village views.
- The old synthetic Uganda leaders, phone numbers, population estimates, PDM data, coordinates, shops, and sales figures were removed from this hierarchy path.
- Fields not supplied by the Electoral Commission are explicitly shown as unavailable or hidden; they are never generated.

## Reproduction and validation

From the project root:

```powershell
node scripts/import-electoral-commission-2022.cjs "..\electoral-commission-2022.json"
npm run validate:ec-2022 -- "..\electoral-commission-2022.json"
npm run lint
npm run build
```

The importer validates the source structure and known totals before writing output. The validator independently checks parent-level uniqueness, complete hierarchy counts, source-section provenance, report consistency, and—when a source path is supplied—the original SHA-256.

## Remaining limitation

The Electoral Commission file supplies administrative names and parent relationships, not geographic geometry or profile facts. Additional official datasets are required before all 2,191 subcounty units can be drawn on the map or before leadership, coordinates, population, PDM, or commercial fields can be populated truthfully.
