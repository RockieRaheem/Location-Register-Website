# Production runbook

## Deployment model

The current implementation targets one trusted Node.js server with a persistent SQLite volume and Firebase Authentication. Build the React client, set `NODE_ENV=production`, and start the Express server, which serves both `/api` and the built SPA.

## Pre-deployment checklist

1. Use Node.js 22 LTS or 24 LTS.
2. Run every release gate in [Testing and quality](../development/testing.md).
3. Back up the SQLite database with a WAL-aware snapshot or SQLite online backup.
4. Confirm `OWNER_EMAILS`, Firebase project ID, credentials, and exact `CORS_ALLOWED_ORIGINS`.
5. Verify Firebase authorized domains, rules, and indexes.
6. Confirm `.env.local` and service-account files are not tracked.
7. Review pending migrations and candidate dataset editions.

## Build and start

```powershell
npm.cmd ci
npm.cmd run build
$env:NODE_ENV='production'
$env:PORT='3000'
npm.cmd start
```

Use a process supervisor or hosting service to restart the server after a crash. Terminate with `SIGTERM` or Ctrl+C so the HTTP server and SQLite connection close cleanly.

## Health checks

- `GET /` should return the application HTML with HTTP 200.
- An unauthenticated `GET /api/v1` should return structured JSON with HTTP 401, never HTML.
- Authenticated `GET /api/v1/session` should return the principal and owner status.
- Monitor JSON logs for status, duration, request ID, principal, and identity type.
- Run `npm.cmd run db:validate` after migrations or data publication.

## Backup and restore

SQLite uses WAL mode. Do not copy only the main file while writes are active. Use SQLite's online backup mechanism, a coordinated filesystem snapshot, or stop the application before copying the database and sidecars.

Before restoring:

1. Stop writes.
2. Preserve the current database as incident evidence.
3. Restore a matched database/WAL snapshot.
4. Run `npm.cmd run db:validate`.
5. Start the service and smoke-test reference and hierarchy endpoints.

## Key and account incidents

- Service API key: revoke the client, create a replacement, update the consumer, and inspect recent usage.
- Firebase account: disable the account, remove claims, and revoke refresh tokens.
- Service account: disable or rotate the credential in Google Cloud, replace the external file, and review Admin activity.
- Never log plaintext API keys, webhook secrets, ID tokens, or service-account contents.

## Data publication

1. Preserve the source and checksum.
2. Run source-specific parsing and validation.
3. Build a candidate edition.
4. Reconcile full paths to existing reference codes.
5. Review unmatched or ambiguous records manually.
6. Back up the active database.
7. Publish transactionally.
8. Validate counts, hierarchy paths, identifiers, and representative API queries.

Incomplete new sources must remain candidates; a newer date alone does not make a dataset a safe complete replacement.

## Scaling beyond one server

Before horizontal scaling:

- migrate SQLite to PostgreSQL or another managed relational store;
- move minute rate-limit state to a shared store;
- deliver webhooks through a durable queue;
- enforce outbound webhook restrictions at the network layer;
- centralize structured logs and metrics;
- retain existing UUIDs and `referenceCode` values during migration.
