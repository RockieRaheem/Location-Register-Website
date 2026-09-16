# Location API v1

The signed-in dashboard includes a dedicated **API Access** developer portal with live scope discovery, token generation, endpoint URLs, cURL/JavaScript/Python examples, pagination guidance, and error documentation. The same contract is available to tools at `GET /api/v1/openapi.json` as OpenAPI 3.1 JSON.

## Authentication

All `/api` routes require a verified Firebase user and a short-lived Firebase ID token:

```http
Authorization: Bearer FIREBASE_ID_TOKEN
```

The Firebase web API key identifies the Firebase project; it is not authorization and must not be accepted as an API credential. Server-side role assignment uses Firebase custom claims through `npm run firebase:set-role` and Application Default Credentials.

Firestore location documents are read-only to client SDKs. All location mutations go through this API so role scope, audit identity, parent integrity, and globally unique immutable reference codes are enforced in one trusted transaction boundary.

## Roles

| Role | Read locations | Create/update | Move/delete and schema | Countries |
| --- | --- | --- | --- | --- |
| `developer` | Yes | No | No | All |
| `contributor` | Yes | Assigned countries | No | Assigned for writes |
| `country_admin` | Yes | Assigned countries | Assigned countries | Assigned for management |
| `admin` | Yes | Yes | Yes | All |
| `manufacturer`, `financial_institution` | Yes | No | No | All |

An account must be active and its Firebase email must be verified. Country assignments are ISO 3166-1 alpha-2 codes stored in the `assignedCountryCodes` custom claim. A user must sign in again or refresh their ID token after claims change.

The owner can additionally assign up to ten immutable `assignedLocationReferenceCodes`. When present, these codes restrict reads to those exact locations and their descendant subtrees. This supports access such as “Kampala District only” or one particular sub-county without creating hardcoded endpoints or duplicating data.

Set `FIREBASE_CHECK_REVOKED_TOKENS=true` on a trusted server with Application Default Credentials when immediate token revocation checks are required. The default still validates token issuer, audience, signature, expiry, email verification, status claim, and role without adding a paid Firebase dependency.

Examples:

```powershell
npm run firebase:set-role -- --email=developer@example.com --role=developer --commit
npm run firebase:set-role -- --email=editor@example.com --role=contributor --countries=UG --commit
npm run firebase:set-role -- --email=manager@example.com --role=country_admin --countries=UG,KE --commit
```

## Stable location references

`referenceCode` is the external API identifier. Its format is `{ISO2}-L{LEVEL}-{UUID}`, for example `UG-L06-00615090C4C85EE68AF1B25044DBE620`.

- It is unique across the database.
- It is generated once and cannot be updated.
- Renaming or moving a location does not change it.
- `uid` remains the internal relational identifier.
- `location_external_ids` continues to map codes issued by outside authorities such as `UG_ADMIN_PCODE`.

Names alone are not globally unique: different districts can contain parishes or villages with the same name. Name-to-code lookup therefore accepts the complete country-to-location path. For bulk mapping, send:

```json
{
  "paths": [
    ["Uganda", "Central", "KAMPALA", "KAWEMPE DIVISION SOUTH", "KAWEMPE DIVISION", "Bwaise II", "KATOOGO"]
  ]
}
```

Each result repeats the supplied path and returns the matched location containing both `name` and `referenceCode`. Unmatched paths return `location: null`; the API never guesses between similarly named places. To map a code back to its name and hierarchy metadata, call `GET /api/v1/locations/{referenceCode}`.

## Core endpoints

| Method | Endpoint | Minimum permission |
| --- | --- | --- |
| `GET` | `/api/v1/countries` | Read |
| `GET` | `/api/v1/openapi.json` | Authenticated OpenAPI 3.1 contract |
| `GET` | `/api/v1/countries/{countryCode}/schema` | Read |
| `PUT` | `/api/v1/countries/{countryCode}/schema` | Country admin for country |
| `GET` | `/api/v1/countries/{countryCode}/locations` | Read |
| `POST` | `/api/v1/countries/{countryCode}/locations` | Contributor for country |
| `GET` | `/api/v1/locations/{referenceCode}` | Read |
| `GET` | `/api/v1/countries/{countryCode}/resolve-location?path=Uganda%7CCentral%7CKampala` | Resolve an unambiguous full hierarchy path |
| `POST` | `/api/v1/countries/{countryCode}/resolve-locations` | Map up to 500 full hierarchy paths to reference IDs in one request |
| `GET` | `/api/v1/locations/{referenceCode}/ancestors` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/descendants` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/children` | Direct children in the assigned scope |
| `GET` | `/api/v1/locations/{referenceCode}/subtree` | Paginated hierarchy rooted at any location |
| `GET` | `/api/v1/locations/{referenceCode}/api` | Discoverable API description and links |
| `GET` | `/api/v1/locations/{referenceCode}/geometry` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/leader` | Read current leader details |
| `GET` | `/api/v1/locations/{referenceCode}/leadership-history` | Read prior assignments and accountability history |
| `PUT` | `/api/v1/locations/{referenceCode}/leader` | Admin, country admin, or contributor in the assigned scope |
| `POST` | `/api/v1/locations/{referenceCode}/leader/end` | End a leader term in the assigned scope |
| `PATCH` | `/api/v1/locations/{referenceCode}` | Contributor for country |
| `POST` | `/api/v1/locations/{referenceCode}/move` | Country admin for country |
| `DELETE` | `/api/v1/locations/{referenceCode}` | Country admin for country |

Leadership is optional at every hierarchy level. A changed name creates a new time-bounded assignment instead of overwriting the former leader. Every create, edit, replacement, and term ending is appended to an immutable audit ledger with the actor UID, email (when available), role, timestamp, and before/after record. Read-only roles can view leadership but cannot change it; scoped contributors cannot write outside their assigned country and location subtree.

List endpoints accept `level`, `parentReferenceCode`, `search`, `limit`, and `offset`. Creating a child uses `parentReferenceCode`; moving a location uses `parentReferenceCode`. External clients therefore never need to persist internal UUID relationships. The server caps a page at 1,000 records. Error responses use HTTP `401`, `403`, `404`, or `409` instead of silently returning unauthorized data.

For example, after obtaining Kampala's immutable reference code, its dedicated API surface is:

```text
GET /api/v1/locations/{KAMPALA_REFERENCE_CODE}/api
GET /api/v1/locations/{KAMPALA_REFERENCE_CODE}/children
GET /api/v1/locations/{KAMPALA_REFERENCE_CODE}/subtree?maxDepth=4&limit=1000
```

The same templates work unchanged for every country and every configured hierarchy level.

```bash
curl -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "http://localhost:3000/api/v1/countries/UG/locations?level=2&limit=100"
```
