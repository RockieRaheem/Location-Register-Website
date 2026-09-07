# Any Location

Any Location is a React, Express, SQLite, and Firebase application for managing country-specific administrative hierarchies. Uganda is represented from country through region, district/city, county/municipality, sub-county/division, parish/ward, and village/cell without hard-coding that hierarchy for other countries.

## Workspace layout

```text
src/                    Application source
  components/           UI grouped by product domain
  config/               Runtime client configuration
  data/                 Typed application and map data
  server/               Express API and SQLite repository
  services/             Firebase and application services
data/                   Source datasets, generated reports, maps, and local database
database/migrations/    Versioned SQLite migrations
firebase/               Firestore indexes/rules, Storage rules, and rule tests
scripts/                Database, import, Firebase, geospatial, and smoke utilities
docs/                   Architecture, audits, security, data, and integration notes
config/                 Repository-level metadata
```

## Local setup

1. Use Node.js 22.13 or newer and run `npm install`.
2. Copy `.env.example` to `.env.local` and supply the Firebase web configuration from project `any-location-36e76`.
3. Run `npm run db:validate` to verify the local hierarchy database.
4. Run `npm run dev` and open <http://localhost:3000>.

Environment files containing credentials are ignored. `.env.example` is the safe configuration template and must not contain secrets.

## Quality commands

- `npm run lint` — TypeScript validation.
- `npm run build` — production client build.
- `npm run validate:ec-2022` — source dataset validation.
- `npm run db:validate` — hierarchy and identifier validation.
- `npm run test:rules` — Firebase Security Rules tests using local emulators.

The default SQLite file is `data/database/location-register.sqlite`. Firebase configuration and operating guidance are documented under [`docs/integrations`](docs/integrations) and [`docs/security`](docs/security).
