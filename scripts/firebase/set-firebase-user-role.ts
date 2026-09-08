import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const email = process.argv.find((value) => value.startsWith('--email='))?.slice('--email='.length).trim().toLowerCase();
const role = process.argv.find((value) => value.startsWith('--role='))?.slice('--role='.length).trim();
const countries = (process.argv.find((value) => value.startsWith('--countries='))?.slice('--countries='.length) || '')
  .split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
const shouldCommit = process.argv.includes('--commit');
const validRoles = ['admin', 'country_admin', 'contributor', 'developer', 'manufacturer', 'financial_institution'];

if (!email || !role || !validRoles.includes(role)) {
  throw new Error('Usage: --email=user@example.com --role=admin|country_admin|contributor|developer|manufacturer|financial_institution [--countries=UG,KE] [--commit]');
}
if (!['country_admin', 'contributor'].includes(role) && countries.length > 0) throw new Error('--countries is only valid for country_admin or contributor.');

console.log(JSON.stringify({ mode: shouldCommit ? 'COMMIT' : 'DRY RUN', email, role, assignedCountryCodes: countries }, null, 2));
if (!shouldCommit) process.exit(0);

const projectId = process.env.FIREBASE_PROJECT_ID || 'any-location-36e76';
if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId });
const authentication = getAuth();
const user = await authentication.getUserByEmail(email);
await authentication.setCustomUserClaims(user.uid, { role, status: 'active', assignedCountryCodes: countries, assignedLocationReferenceCodes: [] });
await getFirestore().doc(`users/${user.uid}`).set({
  uid: user.uid,
  email: user.email,
  name: user.displayName || user.email?.split('@')[0] || 'Location Register user',
  avatar: user.photoURL || null,
  role,
  status: 'active',
  assignedCountryCodes: countries,
  assignedLocationReferenceCodes: [],
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log(`Updated ${email}. The user must sign out and in again to refresh token claims.`);
