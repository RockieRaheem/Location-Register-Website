# Location API v1

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

## Core endpoints

| Method | Endpoint | Minimum permission |
| --- | --- | --- |
| `GET` | `/api/v1/countries` | Read |
| `GET` | `/api/v1/countries/{countryCode}/schema` | Read |
| `PUT` | `/api/v1/countries/{countryCode}/schema` | Country admin for country |
| `GET` | `/api/v1/countries/{countryCode}/locations` | Read |
| `POST` | `/api/v1/countries/{countryCode}/locations` | Contributor for country |
| `GET` | `/api/v1/locations/{referenceCode}` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/ancestors` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/descendants` | Read |
| `GET` | `/api/v1/locations/{referenceCode}/geometry` | Read |
| `PATCH` | `/api/v1/locations/{referenceCode}` | Contributor for country |
| `POST` | `/api/v1/locations/{referenceCode}/move` | Country admin for country |
| `DELETE` | `/api/v1/locations/{referenceCode}` | Country admin for country |

List endpoints accept `level`, `parentReferenceCode`, `search`, `limit`, and `offset`. Creating a child uses `parentReferenceCode`; moving a location uses `parentReferenceCode`. External clients therefore never need to persist internal UUID relationships. The server caps a page at 1,000 records. Error responses use HTTP `401`, `403`, `404`, or `409` instead of silently returning unauthorized data.

```bash
curl -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  "http://localhost:3000/api/v1/countries/UG/locations?level=2&limit=100"
```
