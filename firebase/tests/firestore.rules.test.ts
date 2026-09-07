import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const authToken = (email: string) => ({ email, email_verified: true });
const profile = (uid: string, email: string, role = 'contributor', assignedCountryCodes: string[] = []) => ({
  uid, email, name: uid, avatar: null, role, status: 'active', assignedCountryCodes,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'location-register-rules-test',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => testEnv.cleanup());
beforeEach(async () => testEnv.clearFirestore());

async function seedRegistry() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, 'users', 'ug-manager'), profile('ug-manager', 'manager@example.com', 'country_admin', ['UG']));
    await setDoc(doc(firestore, 'users', 'alice'), profile('alice', 'alice@example.com'));
    await setDoc(doc(firestore, 'users', 'ug-editor'), profile('ug-editor', 'editor@example.com', 'contributor', ['UG']));
    await setDoc(doc(firestore, 'countries', 'UG'), {
      uid: 'country-ug', code: 'UG', name: 'Uganda', rootLocationUid: 'root-ug', schemaVersion: 1,
    });
    await setDoc(doc(firestore, 'countries', 'UG', 'hierarchyLevels', 'ug-level-1'), {
      uid: 'ug-level-1', countryUid: 'country-ug', order: 1, key: 'region', name: 'Region',
      alternateNames: [], allowedTypes: ['Region'], required: true,
    });
    await setDoc(doc(firestore, 'locations', 'root-ug'), {
      uid: 'root-ug', referenceCode: 'UG-L00-00000000000000000000000000000000', countryUid: 'country-ug', countryCode: 'UG', levelUid: null, levelOrder: 0,
      levelKey: 'country', levelName: 'Country', parentUid: null, ancestorUids: [], name: 'Uganda',
      normalizedName: 'uganda', type: 'Country', status: 'active', metadata: {},
    });
  });
}

describe('user profile rules', () => {
  it('allows a user to create only their least-privileged profile', async () => {
    const firestore = testEnv.authenticatedContext('alice', authToken('alice@example.com')).firestore();
    await assertSucceeds(setDoc(doc(firestore, 'users', 'alice'), profile('alice', 'alice@example.com')));
    await assertFails(setDoc(doc(firestore, 'users', 'mallory'), profile('mallory', 'mallory@example.com')));
  });

  it('prevents self-service role escalation', async () => {
    await seedRegistry();
    const firestore = testEnv.authenticatedContext('alice', authToken('alice@example.com')).firestore();
    await assertFails(updateDoc(doc(firestore, 'users', 'alice'), { role: 'admin' }));
  });
});

describe('location hierarchy rules', () => {
  beforeEach(seedRegistry);

  const region = {
    uid: 'region-central', referenceCode: 'UG-L01-00000000000000000000000000000001', countryUid: 'country-ug', countryCode: 'UG', levelUid: 'ug-level-1', levelOrder: 1,
    levelKey: 'region', levelName: 'Region', parentUid: 'root-ug', ancestorUids: ['root-ug'],
    name: 'Central', normalizedName: 'central', type: 'Region', status: 'active', metadata: {},
  };

  it('allows authenticated active users to read and denies anonymous users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice', authToken('alice@example.com')).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, 'locations', 'root-ug')));
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'locations', 'root-ug')));
  });

  it('denies direct client writes even for an assigned country manager', async () => {
    const firestore = testEnv.authenticatedContext('ug-manager', authToken('manager@example.com')).firestore();
    await assertFails(setDoc(doc(firestore, 'locations', region.uid), region));
  });

  it('requires assigned contributors to use the API for writes', async () => {
    const firestore = testEnv.authenticatedContext('ug-editor', authToken('editor@example.com')).firestore();
    await assertFails(setDoc(doc(firestore, 'locations', region.uid), region));
  });

  it('denies contributors, cross-country writes, and invalid ancestry', async () => {
    const aliceDb = testEnv.authenticatedContext('alice', authToken('alice@example.com')).firestore();
    await assertFails(setDoc(doc(aliceDb, 'locations', region.uid), region));

    const managerDb = testEnv.authenticatedContext('ug-manager', authToken('manager@example.com')).firestore();
    await assertFails(setDoc(doc(managerDb, 'locations', 'invalid-ancestor'), { ...region, uid: 'invalid-ancestor', ancestorUids: [] }));
    await assertFails(setDoc(doc(managerDb, 'locations', 'kenya-region'), { ...region, uid: 'kenya-region', countryCode: 'KE' }));
  });

  it('denies client-side subtree deletion', async () => {
    const managerDb = testEnv.authenticatedContext('ug-manager', authToken('manager@example.com')).firestore();
    await assertFails(import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(doc(managerDb, 'locations', 'root-ug'))));
  });
});
