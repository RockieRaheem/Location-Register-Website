# Administrator guide

## Roles

| Role | Typical use | Access |
| --- | --- | --- |
| Owner | Platform operator | Assign roles, manage service clients, and perform all administration |
| `admin` | System administrator | Full country and location management |
| `country_admin` | National data steward | Manage assigned countries |
| `contributor` | Reviewed editor | Create and update within assigned geography |
| `developer` | Human API consumer | Read location data |
| `manufacturer` / `financial_institution` | Business consumer | Read permitted location data |

New users do not grant themselves privileged roles. Owner identity comes from the trusted server variable `OWNER_EMAILS`; Firebase custom claims carry assigned roles and scopes.

## Approve a registered user

1. Sign in with an email listed in `OWNER_EMAILS`.
2. Open **System settings > Registrations & roles**.
3. Select the account.
4. Assign its role.
5. For `country_admin` or `contributor`, select allowed countries or location roots.
6. Save the change.
7. Ask the user to sign out and back in to refresh claims.

The command-line role script is an emergency recovery path, not the normal workflow. It requires Firebase Admin credentials and uses a preview-before-commit pattern documented in [Firebase integration](../integrations/firebase.md).

## Create a service client

1. Open **System settings > API Access > Service clients**.
2. Select **Create service client**.
3. In **Client & geography**, give the integration a recognizable name and select exactly one boundary model.
4. For **Country**, choose one coverage mode:
   - **Whole countries** exposes a searchable multi-country picker. Add every country whose complete configured hierarchy should be available.
   - **Specific locations** permits one country and one or more hierarchy roots; every descendant below each root is included.
5. For an economic zone or regional block, choose the required entries from the selector.
6. In **Permissions & limits**, select only required permissions and set conservative request, daily-quota, and expiry values.
7. In **Review**, verify the identity, geography, permissions, and limits before creating the key.
8. Copy the key immediately. The plaintext is never shown again.

Revoke a client immediately when a system is retired or a key may be exposed. Create a replacement instead of sharing one key between unrelated systems.

## Manage hierarchy data

- Search using names or permanent reference codes.
- Create children only beneath the correct parent level.
- Rename a place without changing its reference code.
- Move or delete locations only after reviewing descendants and downstream integrations.
- Never invent missing geometry, leadership, population, or administrative facts.
- Use candidate dataset editions and reconciliation reports before publishing source changes.

## Manage leaders

Every location can have an optional current leader and historical terms.

1. Navigate to the location.
2. Open its leadership panel.
3. Add verified details and source evidence.
4. When leadership changes, end the existing term and create the replacement.

The audit ledger records the actor, time, and before/after state. Do not overwrite history to represent a change of office holder.

## Spark-plan discipline

- Keep Cloud Storage disabled unless billing and its consequences are deliberately approved.
- Import Firestore locations in the documented numbered batches.
- Do not repeat successful batches unnecessarily because repeated writes consume quota.
- Use SQLite validation locally before consuming Firestore writes.
- Monitor Firebase Console quotas during imports.

## Incident actions

| Incident | Immediate action |
| --- | --- |
| API key exposed | Revoke the service client and issue a replacement |
| User access should end | Disable account, remove role, and revoke sessions |
| Incorrect location edit | Preserve evidence, correct through the API, and review audit history |
| Import mismatch | Stop publication; rerun validation and reconciliation |
| Permission error | Inspect verification, claims, geography, and deployed rules; never open rules publicly |
