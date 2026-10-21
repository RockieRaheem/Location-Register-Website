# Configuration reference

Configuration is loaded from `.env.local` during local development. The file is ignored by Git. Use `.env.example` as the template.

## Browser variables

Variables prefixed with `VITE_` are included in the browser bundle. Never put a private credential in one.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web app identifier |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Authentication domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Configured | Bucket name; uploads remain disabled on Spark |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase Web app sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Analytics measurement ID |
| `VITE_FIREBASE_DATABASE_ID` | No | Firestore database; defaults to `(default)` |
| `VITE_FIREBASE_STORAGE_ENABLED` | No | Keep `false` while Storage is unavailable |

Firebase Web configuration is intentionally visible to browsers. Security comes from authentication, server authorization, and Firebase rules, not hiding the Web API key.

## Server variables

Never expose these with a `VITE_` prefix.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listening port |
| `NODE_ENV` | development | Enables production static serving and security behavior when `production` |
| `LOCATION_DATABASE_PATH` | `data/database/location-register.sqlite` | SQLite registry location |
| `FIREBASE_PROJECT_ID` | `any-location-36e76` | Firebase Admin target project |
| `GOOGLE_APPLICATION_CREDENTIALS` | none | Absolute path to Firebase service-account JSON |
| `OWNER_EMAILS` | none | Comma-separated verified owner email addresses |
| `FIREBASE_CHECK_REVOKED_TOKENS` | production: true | Explicit override for token-revocation checking |
| `CORS_ALLOWED_ORIGINS` | none | Comma-separated exact browser origins allowed in production |

Requests from server-to-server clients do not require a browser CORS origin. Add only trusted browser frontends to `CORS_ALLOWED_ORIGINS`.

## Secret-handling rules

- Store service-account JSON outside the repository.
- Do not paste user ID tokens or service API keys into source, issues, or screenshots.
- Treat `.env.local` as sensitive even though Firebase Web values are public identifiers.
- Rotate an exposed service-client key by revoking it and creating another key.
- Keep production variables in the hosting platform's secret/configuration service.
