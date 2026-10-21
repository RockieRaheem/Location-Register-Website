# Getting started

## Prerequisites

- Windows, macOS, or Linux.
- Node.js 22 LTS or 24 LTS.
- npm.
- A Firebase Web app configuration for project `any-location-36e76`.
- Java 21 or newer only when running Firebase emulators.

Node 26 is not supported by the current Firebase toolchain. On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Install and configure

```powershell
npm.cmd install
Copy-Item .env.example .env.local
```

Open `.env.local` and enter the Firebase Web SDK values from Firebase Console > Project settings > General > Your apps. These browser values identify the Firebase project; they are not Firebase Admin credentials.

Minimum client configuration:

```dotenv
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=any-location-36e76.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=any-location-36e76
VITE_FIREBASE_STORAGE_BUCKET=any-location-36e76.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_DATABASE_ID=(default)
VITE_FIREBASE_STORAGE_ENABLED=false
```

For owner-only server features, also configure `OWNER_EMAILS`. Role assignment and Firestore imports require Application Default Credentials; keep that JSON file outside the repository.

## Verify the data

The repository does not track the generated SQLite database. If the local database already exists, validate it:

```powershell
npm.cmd run db:validate
```

If it is missing or must be rebuilt:

```powershell
npm.cmd run db:seed -- --reset
npm.cmd run db:validate
```

The seed step imports the reviewed source hierarchy and can take longer than an ordinary application start.

## Run the application

```powershell
npm.cmd run dev
```

The Express API and Vite frontend share <http://localhost:3000>. A successful start prints both the URL and absolute SQLite path.

## First sign-in

1. Enable Email/Password and Google providers in Firebase Authentication.
2. Add `localhost` and every production hostname to Authorized domains.
3. Register or sign in from the application.
4. Verify the account email.
5. The configured owner opens **System settings > Registrations & roles** and assigns the appropriate role and geographic scope.
6. Sign out and in again after a claim change so Firebase refreshes the ID token.

## Confirm the installation

```powershell
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run lint:rules
npm.cmd run db:validate
npm.cmd run api:validate
npm.cmd run build
```

Run `npm.cmd run test:rules` separately because it starts the local Firestore emulator and requires Java.

## Common startup failures

### `npm.ps1 cannot be loaded`

Use `npm.cmd run dev`; changing the machine-wide PowerShell execution policy is not required.

### `EADDRINUSE: address already in use 0.0.0.0:3000`

Another server owns port 3000. Find it with `Get-NetTCPConnection -LocalPort 3000` and stop only that process, or run this server with a different `PORT`.

### Firebase permission errors

Confirm the user is verified, has an assigned role, has signed in again after role changes, and the deployed rules match `firebase/firestore.rules`. Do not make Firestore public to bypass the error.

### Firebase popup warnings or logout behavior

Verify the Firebase authorized domains and use the same hostname consistently (`localhost` or `127.0.0.1`, not both). Production token revocation checking is enabled by default.
