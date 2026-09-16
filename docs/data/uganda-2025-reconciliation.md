# Uganda 2024–2025 official-source reconciliation

## Evidence preserved

The workspace contains four official documents under `data/sources/uganda/official-2024-2025/pdf/`: two Electoral Commission 2025 demarcation displays, the EC press release dated 10 January 2025, and the UBOS Kigezi Sub-Region Census 2024 report. `npm run analyze:uganda-official-pdfs` extracts their text reproducibly and records byte length, page count, SHA-256 and authority in `manifest.json`.

## Publication decision

The EC village-split display is authoritative for the electoral areas it contains, but it is not a complete replacement national administrative gazetteer. The deterministic candidate parser currently extracts 136 district/city units, 1,631 subcounty-level units, 2,096 parish/ward paths and 16,490 village paths. The complete active registry contains 145 district/city units, 2,191 subcounty-level units, 8,173 parish/ward paths and 74,794 village paths.

Replacing the active hierarchy with the partial display would delete or hide most valid locations. The 2025 result is therefore registered as a `candidate` dataset edition and exposed through `GET /api/v1/dataset-editions`. It must pass path-by-path reconciliation and reviewed change publication before it can supersede an existing administrative record.

The first exact-path reconciliation maps 10,517 of 16,490 extracted paths (63.78%) to existing immutable reference codes. The remaining 5,973 are review candidates—not automatically new locations. Consumers can inspect the paginated evidence through `GET /api/v1/dataset-editions/{uid}/locations?match=exact|unmatched`.

## Reproduction

```powershell
npm.cmd run analyze:uganda-official-pdfs
npm.cmd run build:uganda-ec-2025-candidate
npm.cmd run reconcile:uganda-ec-2025
```

The parser rejects uncertain row shapes rather than guessing. `ec-2025-parser-report.json` records rejected rows for review. Existing immutable reference codes remain unchanged.
