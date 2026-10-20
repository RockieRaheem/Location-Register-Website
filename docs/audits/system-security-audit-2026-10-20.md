# System quality and security audit — 2026-10-20

## Outcome

The application compiles, builds, and passes its local automated tests. The production dependency graph reports zero known vulnerabilities. Database integrity, permanent reference-code uniqueness, Uganda hierarchy delivery, API credential hashing, machine-client geographic scopes, expiry, revocation, and bounded usage controls were verified.

The Firestore rules tests are implemented and their command now starts only the required suite, but they could not execute on this workstation because the Firebase emulator requires Java and `java` is not installed or available on `PATH`.

## Checks performed

| Area | Result | Evidence |
| --- | --- | --- |
| TypeScript | Pass | `npm.cmd run lint` |
| Unit/security tests | Pass | 8 suites, 31 tests via `npm.cmd test -- --runInBand` |
| Firestore/storage rule lint | Pass | `npm.cmd run lint:rules` |
| Firestore emulator tests | Environment blocked | Firebase CLI reported `spawn java ENOENT` |
| Production build | Pass | Vite transformed 3,161 modules and produced `dist/` |
| Production dependencies | Pass | `npm.cmd audit --omit=dev`: 0 vulnerabilities |
| Full dependency graph | Partial | 28 advisories remain in development/test tooling; automatic fixes require breaking downgrades |
| API platform validation | Pass | hashed key, geographic boundaries, input bounds, expiry, and immediate revocation |
| SQLite integrity | Pass | `PRAGMA integrity_check`: `ok` |
| Location data | Pass | 85,671 unique valid reference codes; 74,794 Uganda villages |
| API delivery | Pass | Kampala resolves and returns 931 descendants including villages |
| Live HTTP smoke test | Pass | SPA 200; protected API JSON 401; security headers present |
| Secret scan | Pass | no tracked API keys, service-account private keys, or local environment files found |
| Unsafe DOM/code scan | Fixed | raw HTML insertion and build-script `eval` removed |

## Confirmed findings and fixes

### High — browser HTML injection paths

The blog rendered `post.content` with `dangerouslySetInnerHTML`, and the flag fallback assigned `innerHTML`. If either value became remotely managed, it could become a cross-site scripting path.

Fixed by rendering article content as escaped readable text and by using React state for the flag fallback. Tests cover markup removal.

### High — webhook server-side request forgery surface

Webhook validation omitted several private/reserved address ranges, did not reject URL credentials, and followed HTTP redirects. A public URL could redirect delivery toward a private service.

Fixed by rejecting local/private IPv4 and IPv6 targets, checking DNS results when registering and delivering, rejecting credential-bearing URLs, restricting event names, and refusing redirects. Network-range tests cover representative public and private addresses.

Residual risk: DNS can change between validation and connection. A production deployment should place outbound webhook delivery behind an egress proxy/firewall that blocks private, metadata, and internal networks at the network layer.

### High — dependency advisories

The initial audit reported 52 advisories, including 2 critical. Non-breaking upgrades and a patched gRPC override reduced the full development graph to 28 advisories with no critical findings. The production graph now reports zero known vulnerabilities. The remaining advisories are transitive development/test-tool findings for which npm proposes breaking package downgrades; `npm audit fix --force` was intentionally not used.

### Medium — unrestricted browser origins

The server previously returned permissive CORS headers for every origin.

Fixed with an exact production allowlist controlled by `CORS_ALLOWED_ORIGINS`. Requests without a browser origin remain available to server-to-server API clients; localhost origins remain permitted in development. Tests verify production rejection and development behavior.

### Medium — API client input bounds

Machine-client names, descriptions, rate limits, quotas, and expiry values relied too heavily on UI constraints. Direct API callers could submit invalid or abusive values.

Fixed with server-side length limits, integer ranges, and timestamp validation. API validation now tests negative rate limits and expired credentials.

### Medium — internal exception disclosure

Unexpected API errors could return their internal exception message.

Fixed by logging the detailed error with its request ID while returning a stable generic error to clients.

### Medium — build-time secret exposure configuration

Vite defined `GEMINI_API_KEY` directly into browser code even though the application did not use it.

Fixed by removing both build-time definitions. Browser Firebase configuration remains intentionally public; Firebase authorization is enforced by rules and authenticated API policy.

### Medium — revoked Firebase sessions

Revocation checks were disabled unless explicitly enabled.

Fixed so production verifies token revocation by default. Development can still explicitly configure the behavior.

### Low — security response headers

The server omitted baseline browser hardening headers.

Fixed with MIME sniffing protection, frame denial, a strict referrer policy, popup-compatible opener isolation for Firebase sign-in, production HSTS, and removal of the Express technology-identification header.

### Low — test separation and unsafe maintenance script

The standard test command always included emulator-only tests, producing false failures when the emulator was absent. A geospatial maintenance script also used `eval` against a source file.

Fixed by separating local and emulator test commands, making emulator cleanup resilient to initialization failure, and parsing map path strings without code evaluation.

## Remaining engineering risks

1. Install a supported Java runtime, put `java` on `PATH`, and run `npm.cmd run test:rules` before deploying Firestore rules.
2. Use Node 22 LTS or Node 24 LTS. The current Node 26 runtime is outside the Firebase tooling support matrix; `package.json` now declares the supported versions.
3. The production JavaScript bundle is about 8.49 MB (2.23 MB gzip). Add route-level lazy loading and split map/data-heavy views to improve first load and memory use.
4. Rate-limit minute buckets are process-local. A multi-instance production deployment needs a shared limiter such as Redis or a managed gateway; daily quotas remain durable in SQLite but SQLite itself is single-host storage.
5. Webhook delivery should use a network-enforced outbound allow policy in production, not application validation alone.
6. Add end-to-end browser tests for Firebase login, hierarchy navigation, API-client creation, and map drill-down. Those flows require emulator credentials/browser automation not present in the current test harness.

## Deployment gates

- Set `NODE_ENV=production`.
- Set an exact `CORS_ALLOWED_ORIGINS` list for every trusted browser frontend.
- Keep `.env.local` and Firebase service-account files outside version control.
- Run `npm.cmd run lint`, `npm.cmd test -- --runInBand`, `npm.cmd run test:rules`, `npm.cmd run db:validate`, `npm.cmd run api:validate`, and `npm.cmd run build` in CI.
- Fail production CI on `npm.cmd audit --omit=dev --audit-level=high`.
