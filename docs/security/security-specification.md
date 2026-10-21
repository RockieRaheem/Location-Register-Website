# Security specification

## Security objectives

Any Location must protect account authority, administrative hierarchy integrity, unpublished data, API credentials, audit history, and infrastructure. A valid identity alone is never sufficient for a privileged operation; role, permission, geographic scope, and resource ancestry must also agree.

## Trust boundaries

| Boundary | Rule |
| --- | --- |
| Browser | Untrusted input; contains only Firebase Web configuration |
| Express API | Trusted authorization and validation boundary |
| SQLite | Trusted server-side state; never exposed as a downloadable file |
| Firebase client SDK | Authentication and profile access constrained by deployed rules |
| Firebase Admin SDK | Trusted server/scripts only; never bundled into the browser |
| External service | Authenticated with a scoped service key; no human session assumptions |
| Webhook destination | Untrusted outbound network target |

## Identity

### Humans

Humans send short-lived Firebase ID tokens as Bearer tokens. The API verifies token signature, issuer, audience, expiry, verified email, account status, and supported role. Production also checks token revocation by default.

The owner allowlist is configured server-side through `OWNER_EMAILS`. Owner status is not accepted from browser state or an editable Firestore field.

### Machines

Service clients use `X-API-Key` or `Authorization: ApiKey <key>`. Keys contain a lookup prefix and random secret. Only a SHA-256 digest is stored; the plaintext is displayed once. Credentials support expiry and immediate revocation.

## Authorization

Authorization combines identity type, role or machine permission, account status, geographic boundary, and location ancestry. Machine permissions are least-privilege scopes:

- `locations:read`
- `geometry:read`
- `leadership:read`
- `locations:write`
- `leadership:manage`
- `audit:read`
- `webhooks:manage`

A geographic grant may cover an economic zone, regional block, selected countries, or selected location roots and descendants. The system rejects ambiguous service-client boundaries.

## Data integrity

- Database constraints enforce country, level, parent, and depth relationships.
- The closure table supports authoritative ancestry checks.
- Public reference codes are unique and immutable.
- Names are not treated as globally unique identifiers.
- Writes are transactional and append audit records.
- Machine writes require an idempotency key.
- Candidate source editions cannot silently replace the active hierarchy.
- Missing facts are represented as unavailable, never generated as if verified.

## API protections

- JSON request bodies are limited to 1 MB.
- API routes never fall through to the HTML application shell.
- Errors use a consistent JSON envelope and do not expose unexpected exception details.
- Responses carry request IDs and API version headers.
- Service clients have bounded per-minute limits and durable daily quotas.
- Production CORS uses exact origins from `CORS_ALLOWED_ORIGINS`.
- Browser responses disable MIME sniffing and framing and use production HSTS.
- Client names, descriptions, quotas, rate limits, expiry, scopes, and references are validated server-side.

## Webhook protections

- Only HTTPS endpoints are accepted.
- URLs containing credentials are rejected.
- Local, link-local, private, and selected reserved IP ranges are rejected.
- DNS results are checked at registration and delivery.
- Redirects are refused.
- Supported event names are allowlisted.
- Requests are signed with a client-specific HMAC secret.

Application validation does not replace network controls. Production should route webhook traffic through an egress policy that blocks private networks and cloud metadata services.

## Firebase rules

- Anonymous registry reads are denied.
- A new user can create only their own least-privileged profile.
- Users cannot grant themselves roles or country scopes.
- Location writes are denied from client SDKs and must use the trusted API/import path.
- Storage remains disabled for the Spark deployment; retained rules restrict ownership, size, and media type if deliberately enabled later.

## Secret management

- `.env.local`, service-account JSON, SQLite runtime files, logs, and generated builds are ignored.
- No private variable uses a `VITE_` prefix.
- Logs must not include API keys, tokens, webhook secrets, or credential files.
- Exposed service keys are revoked rather than edited or recovered.
- Production credentials belong in the deployment platform's secret manager.

## Audit and accountability

Location changes and leadership changes record actor identity, action, timestamp, and before/after state. API logs record request ID, route, status, duration, and authenticated principal without recording credentials.

## Required security tests

- self-service role escalation is denied;
- anonymous registry access is denied;
- direct client location writes are denied;
- cross-country and invalid-ancestry writes are denied;
- API role and subtree policy permits and rejects expected cases;
- API key hashing, expiry, revocation, quota bounds, and geographic expansion work;
- production CORS rejects unknown browser origins;
- webhook private-network detection covers IPv4 and IPv6;
- unsafe HTML is not inserted into the DOM;
- the production dependency audit reports no known vulnerabilities.

Commands and release gates are maintained in [Testing and quality](../development/testing.md). The latest dated review is in [`docs/audits`](../audits/).
