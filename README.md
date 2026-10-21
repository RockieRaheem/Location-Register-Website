# Any Location

Any Location is a location-registry and developer API for configurable administrative hierarchies. It currently provides Uganda from country to village/cell, while the data model allows every country to define its own level names and depth.

## What the system provides

- Interactive African and country maps with hierarchy drill-down.
- Permanent reference codes that map locations to stable API identifiers.
- Firebase sign-in and owner-managed user roles.
- Human and machine API identities with geographic scopes, permissions, quotas, expiry, and revocation.
- Optional leader records and an accountability history for every location.
- JSON, CSV, and GeoJSON access where verified geometry exists.
- Audited SQLite persistence for the validated local registry and staged Firestore synchronization.

## Start locally

Prerequisites: Node.js 22 LTS or 24 LTS and npm. Java 21 or newer is needed only for Firebase emulator tests.

```powershell
git clone <repository-url>
cd Location-Register-Website
npm.cmd install
Copy-Item .env.example .env.local
# Add the Firebase Web SDK values to .env.local.
npm.cmd run db:validate
npm.cmd run dev
```

Open <http://localhost:3000>. If port 3000 is already occupied, stop the existing process before starting another server.

## Essential commands

| Command | Purpose |
| --- | --- |
| `npm.cmd run dev` | Run Express and Vite with file watching |
| `npm.cmd run build` | Create the production client bundle |
| `npm.cmd test -- --runInBand` | Run local unit and security tests |
| `npm.cmd run test:rules` | Run Firestore rules tests in the emulator |
| `npm.cmd run lint` | Type-check the complete TypeScript project |
| `npm.cmd run lint:rules` | Lint Firestore and Storage rules |
| `npm.cmd run db:validate` | Verify database integrity and hierarchy totals |
| `npm.cmd run api:validate` | Verify API credentials and scope enforcement |

PowerShell may block `npm.ps1`; use `npm.cmd` as shown. Never commit `.env.local` or a Firebase service-account JSON file.

## Documentation

Start with the [documentation handbook](docs/README.md). It links to setup, architecture, administration, API integration, data provenance, security, testing, deployment, and troubleshooting guidance.

## Repository at a glance

```text
src/                  React application, services, and Express API
database/migrations/  Versioned SQLite schema
data/                 Reviewed sources, geometry, reports, and ignored runtime DB
firebase/             Firestore indexes/rules, Storage rules, and rule tests
scripts/              Import, validation, Firebase, geospatial, and smoke tools
docs/                 Maintained system handbook and historical audits
references/           Non-runtime source snapshots and local-import convention
```

The local registry is stored at `data/database/location-register.sqlite`. The file is generated runtime state and is intentionally excluded from Git.
