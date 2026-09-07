# Firebase integration for `any-location-36e76`

## What is implemented

- Firebase modular Web SDK initialization through local Vite environment variables.
- Google and Email/Password authentication, email verification, password reset, persistent auth-state observation, and least-privilege user profiles.
- Firestore country-specific hierarchy schemas and UUID-addressable locations with parent and ancestor references.
- Cloud Storage helpers and rules are retained for a future paid deployment, but uploads are explicitly disabled while this project remains on Spark.
- Firestore security rules without hard-coded privileged email addresses.
- Required indexes, emulator configuration, rules tests, role management, and an idempotent bulk importer.

## Data model

`countries/{ISO2}` stores the country UUID, ISO alpha-2 code, name, root location UUID, profile, and hierarchy version. Each country has `countries/{ISO2}/hierarchyLevels/{levelUuid}` documents ordered by `order`. The application therefore does not assume that every country uses Uganda's labels.

`locations/{locationUuid}` stores immutable identity and level fields, `parentUid`, root-to-parent `ancestorUids`, descriptive fields, source provenance, and extensible metadata. Uganda is represented as Country → Region → District/City → County/Municipality/Constituency → Sub-county/Division → Parish/Ward → Village/Cell. Other countries use their own hierarchy-level documents. Existing deterministic UUIDs are preserved across repeated imports.

## One-time Firebase Console setup

The registered `Any-Location` Web app configuration has already been retrieved with the authenticated Firebase CLI and written to ignored `.env.local`. `.env.example` intentionally contains no app-specific API key. Never commit `.env.local` or a service-account key.

1. In Project settings → General → Your apps, verify that the active Web app remains `Any-Location` (`1:592566256817:web:de4337f002e567f03dce90`).
2. If the Firebase Web app is replaced later, retrieve its new configuration and update `.env.local`.
3. In Authentication → Sign-in method, enable **Email/Password** and **Google**. Add production hostnames under Authentication → Settings → Authorized domains.
4. Create Cloud Firestore as the **`(default)`** database and deliberately select its production region. For an East African workload, `africa-south1` (Johannesburg) is the closest Firestore region currently offered on the continent, but the project owner must confirm this permanent infrastructure choice.
5. Do not enable Cloud Storage while the project is on Spark. Firebase requires Blaze for Cloud Storage access as of 2026. The application stores structured records in Firestore and disables file uploads rather than attempting billable storage or embedding files in database documents.

The console URL did not contain the Web SDK values. They were retrieved from Firebase's authenticated app configuration endpoint and were not guessed.

## Verified cloud status on 2026-09-07

- Firebase project `any-location-36e76` and Web app `Any-Location` are active.
- The `(default)` Firestore Native database is active in `africa-south1`, Standard edition, and reports `freeTier: true`.
- The configured bucket name is `any-location-36e76.firebasestorage.app`, but Cloud Storage access is unavailable on Spark and is disabled locally with `VITE_FIREBASE_STORAGE_ENABLED=false`.
- No Firestore records, rules, indexes, roles, or Storage objects were written by this implementation session.

## Local verification

```powershell
npm.cmd run lint
npm.cmd run lint:rules
npm.cmd run build
npm.cmd run test:rules
npm.cmd run db:validate
npm.cmd run firebase:import:locations
```

The last command is a dry run. It prints exact counts and performs no Firebase writes.
The emulator-based rules test requires Java 21 or newer on `PATH`; the rules parser lint does not require Java.

## Deploy rules and indexes

```powershell
npx.cmd firebase-tools login
npx.cmd firebase-tools use any-location-36e76
npm.cmd run firebase:deploy:rules
```

Review index deployment in the console; large indexes can take time to build.

## Bootstrap roles safely

Set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute service-account JSON path outside the repository and set `FIREBASE_PROJECT_ID=any-location-36e76`. Preview, then explicitly commit:

```powershell
npm.cmd run firebase:set-role -- --email=person@example.com --role=admin
npm.cmd run firebase:set-role -- --email=person@example.com --role=admin --commit
npm.cmd run firebase:set-role -- --email=person@example.com --role=country_admin --countries=UG,KE --commit
```

The utility updates the Firestore profile and Auth custom claims together. The user must sign out and back in after a claim change. Email/Password users must verify their email before privileged rules authorize them.

## Import the validated hierarchy

```powershell
npm.cmd run firebase:import:locations
npm.cmd run firebase:import:locations -- --country=UG --batch=1
npm.cmd run firebase:import:locations -- --country=UG --batch=1 --commit
```

Spark permits 20,000 Firestore document writes per quota day. The importer therefore limits each numbered batch to 15,000 locations and refuses an unbatched commit. Import at most one batch per quota day, using batches 1 through 6 for Uganda. Omit `--country=UG` to target every configured country. The Admin SDK uses Application Default Credentials and bypasses Firestore rules, so give its service account minimum IAM permissions. Stable IDs and merge writes make repeats idempotent, but repeating a batch consumes writes again.

## Operational constraints

- Client code may create or edit an individual location only within the caller's assigned country.
- Moving and cascading deletion require trusted backend code because the entire descendant subtree and audit history must be updated.
- The Electoral Commission source supplies names and relationships, not missing geometry, coordinates, leaders, populations, or commercial facts. Firebase does not manufacture those fields.
- Do not make collections public to work around permission errors. Check the profile, verification state, assigned country codes, indexes, and deployed rules.
