import assert from 'node:assert/strict';
import { ApiPlatform } from '../../src/server/apiPlatform.ts';
import { LocationDatabase } from '../../src/server/locationDatabase.ts';
import { allAfricanCountries } from '../../src/data/mockData.ts';

const database = new LocationDatabase(':memory:');
try {
  for (const code of ['UG', 'KE']) {
    const country = allAfricanCountries.find((item) => item.countryCode === code);
    if (!country) throw new Error(`${code} test fixture is unavailable`);
    database.upsertCountry({ ...country, adminLevels: [] });
  }
  const platform = new ApiPlatform(database);
  const created = platform.createClient({
    name: 'Validation client', scopes: ['locations:read'], assignedCountryCodes: ['UG'],
    requestsPerMinute: 10, dailyQuota: 100, expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  }, 'automated-validation');
  assert.match(created.apiKey, /^al_live_[a-f0-9]{12}_[A-Za-z0-9_-]{32,}$/);
  const principal = platform.verifyApiKey(created.apiKey);
  assert.equal(principal?.identityType, 'machine');
  assert.deepEqual(principal?.scopes, ['locations:read']);
  assert.deepEqual(principal?.assignedCountryCodes, ['UG']);
  const zoneClient = platform.createClient({ name: 'Zone client', scopes: ['locations:read'], assignedEconomicZones: ['EASTERN AFRICA'] }, 'automated-validation');
  assert.deepEqual(platform.verifyApiKey(zoneClient.apiKey)?.assignedCountryCodes, ['KE', 'UG']);
  const blockClient = platform.createClient({ name: 'Block client', scopes: ['locations:read'], assignedRegionalBlocks: ['EAC'] }, 'automated-validation');
  assert.deepEqual(platform.verifyApiKey(blockClient.apiKey)?.assignedCountryCodes, ['KE', 'UG']);
  assert.throws(() => platform.createClient({ name: 'Ambiguous client', scopes: ['locations:read'], assignedCountryCodes: ['UG'], assignedRegionalBlocks: ['EAC'] }, 'automated-validation'), /exactly one geographic scope type/);
  assert.throws(() => platform.createClient({ name: 'Invalid quota', scopes: ['locations:read'], assignedCountryCodes: ['UG'], requestsPerMinute: -1 }, 'automated-validation'), /requestsPerMinute/);
  assert.throws(() => platform.createClient({ name: 'Invalid expiry', scopes: ['locations:read'], assignedCountryCodes: ['UG'], expiresAt: new Date(Date.now() - 1000).toISOString() }, 'automated-validation'), /future ISO date/);
  const credential = database.db.prepare('SELECT key_hash FROM api_credentials WHERE client_uid = ?').get(created.clientUid) as { key_hash: string };
  assert.notEqual(credential.key_hash, created.apiKey);
  assert.equal(credential.key_hash.length, 64);
  platform.revokeClient(created.clientUid);
  assert.equal(platform.verifyApiKey(created.apiKey), null);
  console.log(JSON.stringify({ valid: true, hashedCredential: true, scopedMachinePrincipal: true, geographicBoundaryExpansion: true, ambiguousBoundaryRejected: true, inputBoundsEnforced: true, immediateRevocation: true }, null, 2));
} finally {
  database.close();
}
