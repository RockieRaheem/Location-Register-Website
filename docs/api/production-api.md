# Production API controls

## Identities and credentials

Human sessions use verified Firebase ID tokens. External systems use owner-issued keys in `X-API-Key` or `Authorization: ApiKey …`. Only a SHA-256 digest and non-secret prefix are stored. The plaintext key is displayed once. Credentials support expiry, immediate revocation, country/location assignments and these scopes:

- `locations:read`
- `geometry:read`
- `leadership:read`
- `locations:write`
- `leadership:manage`
- `audit:read`
- `webhooks:manage`

The owner creates and revokes service clients from **API Access → Service Clients**.

## Traffic controls

Each service client has a requests-per-minute limit and daily quota. Responses report `RateLimit-Limit`, `RateLimit-Remaining`, `X-Daily-Quota-Limit` and `X-Daily-Quota-Remaining`. HTTP 429 responses include a structured error. The minute counter is process-local; a multi-instance deployment must replace it with a shared Redis-compatible limiter while retaining the durable daily counter.

Every response includes `X-Request-Id`; clients may supply their own safe request ID. Server logs are single-line JSON containing time, request ID, method, path, status, duration, principal and identity type.

## Reliable writes

Machine writes require an `Idempotency-Key` of 8–128 safe characters. Records are retained for 24 hours. Reusing the same key and payload replays the saved response; reusing it for a different request returns HTTP 409.

## Exports and editions

`GET /api/v1/countries/{countryCode}/export` supports paginated `json`, `csv` and `geojson`. GeoJSON includes only records with verified stored geometry. `GET /api/v1/dataset-editions` reports source editions and candidate/published status.

## Webhooks

Machine clients with `webhooks:manage` can register HTTPS URLs through `POST /api/v1/webhooks`. Events include a UUID, type, API version, timestamp and data. Deliveries use `X-Any-Location-Signature: sha256=…`, `X-Any-Location-Delivery` and `X-Any-Location-Event`. The signing secret is displayed once. Delivery attempts and outcomes are retained.

Current events are `location.created`, `location.updated`, `location.moved`, `location.deleted` and `leadership.changed`. The Spark-compatible single-server deployment performs three bounded attempts and records each outcome. A future multi-instance deployment should move the same delivery records to a durable worker queue so retries survive process restarts.

## Versioning and errors

Version 1 responses include `API-Version: 1`, `Deprecation: false` and an OpenAPI service-description link. Errors use `{ "error": { "code", "message", "requestId" } }`. Breaking changes require a new `/api/v2` prefix; deprecated versions must publish `Deprecation`, `Sunset` and migration-link headers before removal.
