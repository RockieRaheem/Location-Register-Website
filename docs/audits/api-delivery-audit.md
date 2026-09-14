# API delivery audit

Date: 2026-09-14

## Verified data

The API's SQLite migration store contains the complete supplied Uganda electoral hierarchy: 1 country root, 5 regions, 145 districts/cities, 347 counties/municipalities, 2,191 sub-counties/divisions, 8,173 parishes/wards, and 74,794 villages/cells. Every record has a unique immutable public `referenceCode`. Automated tests now query this real database, resolve Kampala by reference code, and retrieve its paginated descendants through the same repository used by the HTTP API.

## Findings and fixes

1. A `level=0` query was ignored because zero was treated as false. The database filter now explicitly accepts level zero, so country-root requests return only the root.
2. Country assignments did not reliably limit reads. A user assigned to Uganda could still read other countries because an empty location-scope list was interpreted as globally allowed. Country-scoped reads now deny other countries.
3. Combining a country assignment with a narrower location assignment allowed the broader country access to override the subtree. Location references now take precedence and restrict access to those roots and descendants.
4. Legacy `/api/location-registry` read routes bypassed location-scope checks. Exact-record, reference, hierarchy, list, ancestor, descendant, and geometry reads now enforce the same scope policy as `/api/v1`.
5. Descendant responses omitted `limit` and `offset` even though the developer documentation promised pagination metadata. Both fields are now returned after server-side clamping.
6. The OpenAPI document omitted two implemented endpoints (`/locations/{referenceCode}/api` and `/descendants`). Both are now included and contract-tested.

## Integration contract

Consumers call the deployed server's `/api/v1` URL with `Authorization: Bearer <Firebase ID token>`. A Firebase Web API key is only a project identifier and is not an Any-Location API credential. ID tokens are short-lived, so browser/mobile integrations must use the Firebase SDK to refresh them. Server-to-server consumers need a deliberate credential exchange or managed API-key feature before unattended long-running integrations can be considered production-ready.

The current Express API reads the validated SQLite store. Firebase Authentication controls identity and roles, while Firestore remains an incomplete migration target under Spark daily quotas. A public production API additionally requires hosting this stateful Express server and SQLite database on a persistent host; Firebase static Hosting on Spark cannot run this server process.

## Release checks

- TypeScript compilation
- API authorization unit tests
- OpenAPI contract tests
- Real Uganda database response tests
- Full database integrity and hierarchy validation
- Production frontend build

