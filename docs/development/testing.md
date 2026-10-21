# Testing and quality

## Test layers

| Layer | Command | What it verifies |
| --- | --- | --- |
| TypeScript | `npm.cmd run lint` | Types and module references |
| Unit/security | `npm.cmd test -- --runInBand` | API policy, scopes, profiles, OpenAPI, timezones, CORS, network safety, and safe text |
| Rules lint | `npm.cmd run lint:rules` | Firestore and Storage rules syntax/security lint |
| Rules emulator | `npm.cmd run test:rules` | Authenticated Firestore reads and denied privilege escalation/writes |
| Database | `npm.cmd run db:validate` | SQLite integrity, hierarchy totals, paths, references, geometry, and Kampala delivery |
| API platform | `npm.cmd run api:validate` | Credential hashing, scope expansion, expiry, bounds, and revocation |
| Documentation | `npm.cmd run docs:validate` | Maintained local Markdown links |
| Production build | `npm.cmd run build` | Browser production compilation |
| Dependency audit | `npm.cmd audit --omit=dev` | Known production dependency advisories |

## Recommended pre-commit sequence

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run lint:rules
npm.cmd run db:validate
npm.cmd run api:validate
npm.cmd run docs:validate
npm.cmd run build
git diff --check
```

Run the Firebase rules suite whenever rules or profile fields change:

```powershell
java -version
npm.cmd run test:rules
```

## Adding tests

- Put pure module tests beside their source.
- Test both allowed and denied authorization paths.
- Use an in-memory SQLite database for repository/API platform tests where possible.
- Do not call production Firebase services from unit tests.
- Use the Firebase emulator for rules behavior.
- Verify reference codes and full hierarchy paths; do not assume a name is globally unique.
- Add a regression test before fixing a confirmed defect when practical.

## Release gate

A release is not ready when TypeScript, unit tests, rules lint, database validation, API validation, production build, or production dependency audit fails. An emulator test blocked by a missing local dependency is not a pass; install Java and rerun it in CI.
