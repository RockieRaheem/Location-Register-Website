import assert from 'node:assert/strict';
import { ApiPlatform } from '../../src/server/apiPlatform.ts';
import { LocationDatabase } from '../../src/server/locationDatabase.ts';

const database = new LocationDatabase(':memory:');
try {
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
  const credential = database.db.prepare('SELECT key_hash FROM api_credentials WHERE client_uid = ?').get(created.clientUid) as { key_hash: string };
  assert.notEqual(credential.key_hash, created.apiKey);
  assert.equal(credential.key_hash.length, 64);
  platform.revokeClient(created.clientUid);
  assert.equal(platform.verifyApiKey(created.apiKey), null);
  console.log(JSON.stringify({ valid: true, hashedCredential: true, scopedMachinePrincipal: true, immediateRevocation: true }, null, 2));
} finally {
  database.close();
}
