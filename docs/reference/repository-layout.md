# Repository layout

```text
.
├── src/
│   ├── components/       React UI grouped by domain
│   ├── config/           Firebase browser configuration
│   ├── contexts/         Language and timezone state
│   ├── data/             Typed UI data and generated map modules
│   ├── server/           Express API, policy, OpenAPI, and SQLite repository
│   ├── services/         Active Firebase and application services
│   ├── shared/           Shared logic with tests
│   └── utils/            Focused reusable utilities
├── database/migrations/  Ordered SQLite migrations
├── data/
│   ├── sources/          Reviewed external data grouped by country/edition
│   ├── geospatial/       Geometry inputs and generated map assets
│   ├── reports/          Generated validation/reconciliation evidence
│   └── database/         Ignored runtime SQLite files
├── firebase/             Rules, indexes, and emulator tests
├── scripts/              Reproducible maintenance commands
├── docs/                 Maintained handbook and audit records
└── references/           Non-runtime provenance and ignored local imports
```

## Placement rules

- Put runtime TypeScript under `src/`, grouped by responsibility.
- Put tests next to the module as `*.test.ts` unless they require a dedicated environment.
- Add schema changes as a new numbered migration; never rewrite a migration already used by a database.
- Keep original country sources immutable under `data/sources/<country>/<edition>/`.
- Put derived evidence under `data/reports/` and document the script that produced it.
- Put one-time utilities in the appropriate `scripts/` subdirectory only when they remain reproducible and useful.
- Do not commit build output, logs, environment files, service credentials, SQLite runtime files, or personal downloads.

## Generated versus source files

Generated files must be reproducible from committed inputs and scripts. The Git-ignored `dist/`, `node_modules/`, logs, and SQLite sidecars can be regenerated. Official PDFs, source JSON/GeoJSON, licenses, migrations, and reconciliation evidence are retained because they explain how the registry was built.
