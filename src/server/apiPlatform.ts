import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type express from 'express';
import type { LocationDatabase } from './locationDatabase.ts';
import { apiPrincipal, type ApiPrincipal } from './apiAuth.ts';

const machineScopes = new Set(['locations:read', 'geometry:read', 'leadership:read', 'locations:write', 'leadership:manage', 'audit:read', 'webhooks:manage']);
const minuteBuckets = new Map<string, { minute: number; count: number }>();
const json = (value: unknown) => JSON.stringify(value);
const parse = <T>(value: unknown, fallback: T): T => { try { return typeof value === 'string' ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface ApiClientInput {
  name: string; description?: string; scopes: string[]; assignedCountryCodes?: string[];
  assignedLocationReferenceCodes?: string[]; requestsPerMinute?: number; dailyQuota?: number; expiresAt?: string;
}

export class ApiPlatform {
  constructor(private readonly locations: LocationDatabase) {}

  requestContext(): express.RequestHandler {
    return (request, response, next) => {
      const requestId = String(request.header('x-request-id') || randomUUID()).slice(0, 128);
      response.setHeader('X-Request-Id', requestId);
      response.locals.requestId = requestId;
      const started = Date.now();
      const originalJson = response.json.bind(response);
      response.json = ((body: unknown) => {
        if (response.statusCode >= 400 && body && typeof body === 'object' && !('error' in body)) {
          const legacy = body as { code?: string; message?: string };
          return originalJson({ error: { code: legacy.code || `HTTP_${response.statusCode}`, message: legacy.message || 'Request failed', requestId } });
        }
        return originalJson(body);
      }) as express.Response['json'];
      response.on('finish', () => console.log(json({ timestamp: new Date().toISOString(), level: response.statusCode >= 500 ? 'error' : 'info', requestId, method: request.method, path: request.originalUrl.split('?')[0], status: response.statusCode, durationMs: Date.now() - started, principalUid: response.locals.principalUid || null, identityType: response.locals.identityType || null })));
      next();
    };
  }

  versionHeaders(): express.RequestHandler {
    return (request, response, next) => {
      if (request.path.startsWith('/api/v1')) {
        response.setHeader('API-Version', '1');
        response.setHeader('Deprecation', 'false');
        response.setHeader('Link', '</api/v1/openapi.json>; rel="service-desc"');
      }
      next();
    };
  }

  verifyApiKey(rawKey: string): ApiPrincipal | null {
    const match = rawKey.match(/^al_live_([a-f0-9]{12})_([A-Za-z0-9_-]{32,})$/);
    if (!match) return null;
    const row = this.locations.db.prepare(`SELECT credential.*, client.name, client.status, client.assigned_country_codes_json, client.assigned_location_reference_codes_json, client.requests_per_minute, client.daily_quota FROM api_credentials credential JOIN api_clients client ON client.uid = credential.client_uid WHERE credential.key_prefix = ?`).get(match[1]) as Record<string, unknown> | undefined;
    if (!row || row.status !== 'active' || row.revoked_at || (row.expires_at && String(row.expires_at) <= new Date().toISOString())) return null;
    const actual = Buffer.from(sha256(rawKey), 'hex'); const expected = Buffer.from(String(row.key_hash), 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    this.locations.db.prepare(`UPDATE api_credentials SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE uid = ?`).run(String(row.uid));
    return {
      uid: String(row.client_uid), email: undefined, role: 'developer', identityType: 'machine', clientId: String(row.client_uid),
      scopes: parse<string[]>(row.scopes_json, []), assignedCountryCodes: parse<string[]>(row.assigned_country_codes_json, []),
      assignedLocationReferenceCodes: parse<string[]>(row.assigned_location_reference_codes_json, []),
      requestsPerMinute: Number(row.requests_per_minute), dailyQuota: Number(row.daily_quota),
    };
  }

  usageLimits(): express.RequestHandler {
    return (request, response, next) => {
      const principal = apiPrincipal(request); response.locals.principalUid = principal.uid; response.locals.identityType = principal.identityType || 'human';
      if (principal.identityType !== 'machine' || !principal.clientId) return next();
      const minute = Math.floor(Date.now() / 60000); const bucket = minuteBuckets.get(principal.clientId);
      const current = bucket?.minute === minute ? bucket : { minute, count: 0 }; current.count += 1; minuteBuckets.set(principal.clientId, current);
      response.setHeader('RateLimit-Limit', String(principal.requestsPerMinute || 60)); response.setHeader('RateLimit-Remaining', String(Math.max(0, (principal.requestsPerMinute || 60) - current.count)));
      if (current.count > (principal.requestsPerMinute || 60)) { response.setHeader('Retry-After', '60'); return response.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'Per-minute request limit exceeded.' }); }
      const date = new Date().toISOString().slice(0, 10);
      this.locations.db.prepare(`INSERT INTO api_usage_daily(client_uid, usage_date, request_count) VALUES (?, ?, 1) ON CONFLICT(client_uid, usage_date) DO UPDATE SET request_count = request_count + 1`).run(principal.clientId, date);
      const used = Number((this.locations.db.prepare('SELECT request_count FROM api_usage_daily WHERE client_uid = ? AND usage_date = ?').get(principal.clientId, date) as { request_count: number }).request_count);
      response.setHeader('X-Daily-Quota-Limit', String(principal.dailyQuota)); response.setHeader('X-Daily-Quota-Remaining', String(Math.max(0, (principal.dailyQuota || 10000) - used)));
      if (used > (principal.dailyQuota || 10000)) return response.status(429).json({ code: 'DAILY_QUOTA_EXCEEDED', message: 'Daily API quota exceeded.' });
      next();
    };
  }

  idempotency(): express.RequestHandler {
    return (request, response, next) => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();
      const principal = apiPrincipal(request); const key = request.header('idempotency-key');
      if (principal.identityType === 'machine' && !key) return response.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Machine write requests require an Idempotency-Key header.' });
      if (!key) return next();
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return response.status(400).json({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must contain 8-128 safe characters.' });
      const requestHash = sha256(json(request.body || null));
      const existing = this.locations.db.prepare('SELECT * FROM api_idempotency_records WHERE principal_uid = ? AND idempotency_key = ? AND expires_at > ?').get(principal.uid, key, new Date().toISOString()) as Record<string, unknown> | undefined;
      if (existing) {
        if (existing.method !== request.method || existing.request_path !== request.path || existing.request_hash !== requestHash) return response.status(409).json({ code: 'IDEMPOTENCY_CONFLICT', message: 'This idempotency key was already used for a different request.' });
        if (existing.response_status) { response.setHeader('Idempotency-Replayed', 'true'); return response.status(Number(existing.response_status)).json(parse(existing.response_json, {})); }
        return response.status(409).json({ code: 'REQUEST_IN_PROGRESS', message: 'A request with this idempotency key is already in progress.' });
      }
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      this.locations.db.prepare('INSERT INTO api_idempotency_records(principal_uid, idempotency_key, method, request_path, request_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(principal.uid, key, request.method, request.path, requestHash, expires);
      const originalJson = response.json.bind(response);
      response.json = ((body: unknown) => { this.locations.db.prepare('UPDATE api_idempotency_records SET response_status = ?, response_json = ? WHERE principal_uid = ? AND idempotency_key = ?').run(response.statusCode, json(body), principal.uid, key); return originalJson(body); }) as express.Response['json'];
      next();
    };
  }

  createClient(input: ApiClientInput, actor: string) {
    const name = String(input.name || '').trim(); if (!name) throw new Error('name is required');
    const scopes = [...new Set(input.scopes || [])]; if (!scopes.length || scopes.some((scope) => !machineScopes.has(scope))) throw new Error('Select one or more valid scopes');
    const clientUid = randomUUID(); const credentialUid = randomUUID(); const prefix = randomBytes(6).toString('hex'); const secret = randomBytes(32).toString('base64url'); const apiKey = `al_live_${prefix}_${secret}`;
    const countries = [...new Set((input.assignedCountryCodes || []).map((code) => code.toUpperCase()))]; const references = [...new Set((input.assignedLocationReferenceCodes || []).map((code) => code.toUpperCase()))];
    if (countries.some((code) => !/^[A-Z]{2}$/.test(code))) throw new Error('Country assignments must use ISO alpha-2 codes');
    const invalidReference = references.find((code) => !this.locations.getLocationByReferenceCode(code)); if (invalidReference) throw new Error(`Location reference not found: ${invalidReference}`);
    if (input.expiresAt && (Number.isNaN(Date.parse(input.expiresAt)) || input.expiresAt <= new Date().toISOString())) throw new Error('expiresAt must be a future ISO date');
    this.locations.transaction(() => {
      this.locations.db.prepare('INSERT INTO api_clients(uid, name, description, assigned_country_codes_json, assigned_location_reference_codes_json, requests_per_minute, daily_quota, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(clientUid, name, input.description || null, json(countries), json(references), input.requestsPerMinute || 60, input.dailyQuota || 10000, actor);
      this.locations.db.prepare('INSERT INTO api_credentials(uid, client_uid, key_prefix, key_hash, scopes_json, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(credentialUid, clientUid, prefix, sha256(apiKey), json(scopes), input.expiresAt || null);
    });
    return { clientUid, credentialUid, apiKey, keyPrefix: prefix, scopes, warning: 'Copy this API key now. It cannot be retrieved again.' };
  }

  listClients() {
    return (this.locations.db.prepare(`SELECT client.*, credential.key_prefix, credential.scopes_json, credential.expires_at, credential.last_used_at, credential.revoked_at FROM api_clients client LEFT JOIN api_credentials credential ON credential.client_uid = client.uid ORDER BY client.created_at DESC`).all() as Record<string, unknown>[]).map((row) => ({ ...row, assignedCountryCodes: parse(row.assigned_country_codes_json, []), assignedLocationReferenceCodes: parse(row.assigned_location_reference_codes_json, []), scopes: parse(row.scopes_json, []), key_hash: undefined, signing_secret: undefined }));
  }

  revokeClient(uid: string) { return this.locations.transaction(() => { this.locations.db.prepare(`UPDATE api_clients SET status = 'revoked', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE uid = ?`).run(uid); this.locations.db.prepare(`UPDATE api_credentials SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE client_uid = ? AND revoked_at IS NULL`).run(uid); }); }

  createWebhook(clientUid: string, url: string, events: string[]) {
    const parsedUrl = new URL(url); if (parsedUrl.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
    const hostname = parsedUrl.hostname.toLowerCase(); const ipVersion = isIP(hostname);
    if (hostname === 'localhost' || hostname.endsWith('.local') || (ipVersion && /^(127\.|10\.|192\.168\.|169\.254\.|::1$|fc|fd)/i.test(hostname))) throw new Error('Webhook URL must not target a local or private network address');
    const uid = randomUUID(); const secret = randomBytes(32).toString('base64url');
    this.locations.db.prepare('INSERT INTO webhook_subscriptions(uid, client_uid, url, events_json, signing_secret) VALUES (?, ?, ?, ?, ?)').run(uid, clientUid, parsedUrl.toString(), json([...new Set(events)]), secret);
    return { uid, url: parsedUrl.toString(), events, signingSecret: secret, warning: 'Copy the signing secret now.' };
  }

  listWebhooks(clientUid: string) {
    return (this.locations.db.prepare(`SELECT uid, url, events_json, status, created_at FROM webhook_subscriptions WHERE client_uid = ? ORDER BY created_at DESC`).all(clientUid) as Record<string, unknown>[])
      .map((row) => ({ uid: row.uid, url: row.url, events: parse(row.events_json, []), status: row.status, createdAt: row.created_at }));
  }

  disableWebhook(clientUid: string, uid: string) {
    return Number(this.locations.db.prepare(`UPDATE webhook_subscriptions SET status = 'disabled' WHERE uid = ? AND client_uid = ?`).run(uid, clientUid).changes) > 0;
  }

  private async deliverWebhook(row: Record<string, unknown>, eventId: string, eventType: string, body: string) {
    const signature = createHmac('sha256', String(row.signing_secret)).update(body).digest('hex');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, attempt === 2 ? 1000 : 5000));
      const deliveryUid = randomUUID();
      this.locations.db.prepare('INSERT INTO webhook_deliveries(uid, subscription_uid, event_id, event_type, attempt) VALUES (?, ?, ?, ?, ?)').run(deliveryUid, String(row.uid), eventId, eventType, attempt);
      try {
        const result = await fetch(String(row.url), { method: 'POST', headers: { 'content-type': 'application/json', 'x-any-location-event': eventType, 'x-any-location-delivery': eventId, 'x-any-location-signature': `sha256=${signature}` }, body, signal: AbortSignal.timeout(10000) });
        this.locations.db.prepare('UPDATE webhook_deliveries SET response_status = ?, delivered_at = CASE WHEN ? BETWEEN 200 AND 299 THEN strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') END WHERE uid = ?').run(result.status, result.status, deliveryUid);
        if (result.ok) return;
      } catch (error) { this.locations.db.prepare('UPDATE webhook_deliveries SET error_message = ? WHERE uid = ?').run(String(error).slice(0, 1000), deliveryUid); }
    }
  }

  emit(eventType: string, payload: unknown) {
    const eventId = randomUUID(); const body = json({ id: eventId, type: eventType, apiVersion: 'v1', occurredAt: new Date().toISOString(), data: payload });
    const rows = this.locations.db.prepare(`SELECT * FROM webhook_subscriptions WHERE status = 'active'`).all() as Record<string, unknown>[];
    for (const row of rows) {
      if (!parse<string[]>(row.events_json, []).includes(eventType) && !parse<string[]>(row.events_json, []).includes('*')) continue;
      void this.deliverWebhook(row, eventId, eventType, body);
    }
    return eventId;
  }
}
