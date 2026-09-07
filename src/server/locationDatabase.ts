import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type {
  AdminLevel,
  AdminLevelName,
  Country,
  LocationHierarchyLevel,
  LocationHierarchySchema,
  LocationGeometry,
  LocationRecord,
} from '../types.ts';

const UUID_NAMESPACE = '65f4ff08-09bb-52a7-94de-920fa2298f67';

type SqlRow = Record<string, SQLInputValue>;

export interface NewLocationInput {
  uid?: string;
  countryCode: string;
  parentUid: string;
  levelOrder: number;
  name: string;
  type: string;
  legacyId?: number;
  status?: LocationRecord['status'];
  source?: LocationRecord['source'];
  metadata?: Record<string, unknown>;
}

export interface LocationListOptions {
  parentUid?: string;
  levelOrder?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

export function deterministicUuid(name: string, namespace = UUID_NAMESPACE): string {
  const hash = createHash('sha1').update(uuidToBytes(namespace)).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeLocationName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

export function hierarchyLevelKey(value: string, order: number): string {
  const key = normalizeLocationName(value)
    .toLowerCase()
    .replace(/\b(lc\d+)\b/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || `level_${order}`;
}

function parseJson<T>(value: SQLInputValue, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function clampLimit(value: number | undefined): number {
  if (!Number.isInteger(value)) return 100;
  return Math.min(Math.max(value as number, 1), 1000);
}

export class LocationDatabase {
  readonly db: DatabaseSync;

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new DatabaseSync(databasePath);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private migrate(): void {
    const migrationsDirectory = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.readdirSync(migrationsDirectory)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      const version = Number.parseInt(file.split('_')[0], 10);
      const migrationTableExists = this.db.prepare(`
        SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'
      `).get();
      const applied = migrationTableExists
        ? this.db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)
        : undefined;
      if (applied) continue;
      const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
      this.transaction(() => {
        this.db.exec(sql);
        this.db.prepare('INSERT INTO schema_migrations(version, name) VALUES (?, ?)').run(version, file);
      });
    }
  }

  upsertCountry(country: Country): Country {
    const iso2 = requiredString(country.countryCode, 'countryCode').toUpperCase();
    if (!/^[A-Z]{2}$/.test(iso2)) throw new Error('countryCode must be ISO alpha-2');
    const uid = country.uid || deterministicUuid(`country:${iso2}`);
    const rootUid = country.rootLocationUid || deterministicUuid(`location:${iso2}:country`);
    const now = new Date().toISOString();
    const { adminLevels: _areas, adminLevelNames: _levelNames, uid: _uid, rootLocationUid: _root, ...profile } = country;

    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO countries(uid, legacy_id, iso2, name, profile_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(uid) DO UPDATE SET
          legacy_id = excluded.legacy_id,
          iso2 = excluded.iso2,
          name = excluded.name,
          profile_json = excluded.profile_json,
          updated_at = excluded.updated_at
      `).run(uid, country.id, iso2, requiredString(country.name, 'name'), JSON.stringify(profile), now);

      this.db.prepare(`
        INSERT INTO locations(uid, country_uid, level_uid, parent_uid, legacy_id, depth, name, normalized_name, type_label, metadata_json)
        VALUES (?, ?, NULL, NULL, NULL, 0, ?, ?, 'Country', '{}')
        ON CONFLICT(uid) DO UPDATE SET name = excluded.name, normalized_name = excluded.normalized_name, updated_at = ?
      `).run(rootUid, uid, country.name, normalizeLocationName(country.name), now);

      this.db.prepare('UPDATE countries SET root_location_uid = ? WHERE uid = ?').run(rootUid, uid);
      this.upsertHierarchyLevelsUnsafe(uid, iso2, country.adminLevelNames || [], country.numberOfAdminLevels || 0);
    });

    const saved = this.getCountryByCode(iso2);
    if (!saved) throw new Error(`Failed to persist country ${iso2}`);
    return saved;
  }

  private upsertHierarchyLevelsUnsafe(
    countryUid: string,
    countryCode: string,
    definitions: AdminLevelName[],
    numberOfLevels: number,
  ): void {
    const count = Math.max(numberOfLevels, definitions.length);
    for (let index = 1; index <= count; index += 1) {
      const definition = definitions.find((item) => item.level === index);
      const name = definition?.name?.trim() || `Level ${index}`;
      const key = definition?.key || hierarchyLevelKey(name, index);
      const uid = deterministicUuid(`hierarchy-level:${countryCode}:${index}:${key}`);
      this.db.prepare(`
        INSERT INTO hierarchy_levels(
          uid, country_uid, level_order, level_key, name, alternate_names_json, allowed_types_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(country_uid, level_order) DO UPDATE SET
          name = excluded.name,
          alternate_names_json = excluded.alternate_names_json,
          allowed_types_json = excluded.allowed_types_json,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `).run(
        uid,
        countryUid,
        index,
        key,
        name,
        JSON.stringify(definition?.alternateNames || []),
        JSON.stringify(definition?.allowedTypes || []),
      );
    }
  }

  setHierarchy(countryCode: string, definitions: AdminLevelName[]): LocationHierarchySchema {
    const country = this.getCountryRow(countryCode);
    if (!country) throw new Error(`Country not found: ${countryCode}`);
    const sorted = [...definitions].sort((a, b) => a.level - b.level);
    sorted.forEach((definition, index) => {
      if (definition.level !== index + 1) throw new Error('Hierarchy levels must be contiguous and start at 1');
    });

    this.transaction(() => {
      const existingMax = Number((this.db.prepare(`
        SELECT COALESCE(MAX(depth), 0) AS max_depth FROM locations WHERE country_uid = ?
      `).get(country.uid) as SqlRow).max_depth);
      if (existingMax > sorted.length) throw new Error('Cannot remove hierarchy levels that still contain locations');
      this.upsertHierarchyLevelsUnsafe(String(country.uid), String(country.iso2), sorted, sorted.length);
      this.db.prepare('DELETE FROM hierarchy_levels WHERE country_uid = ? AND level_order > ?')
        .run(country.uid, sorted.length);
      this.db.prepare('UPDATE countries SET hierarchy_version = hierarchy_version + 1 WHERE uid = ?').run(country.uid);
    });
    return this.getHierarchy(countryCode);
  }

  syncManagedLocations(country: Country): Country {
    const savedCountry = this.upsertCountry(country);
    const countryRow = this.getCountryRow(country.countryCode);
    if (!countryRow) throw new Error(`Country not found: ${country.countryCode}`);
    const countryUid = String(countryRow.uid);
    const rootUid = String(countryRow.root_location_uid);
    const incoming = country.adminLevels || [];
    const uidByLegacyId = new Map<number, string>();
    for (const area of incoming) {
      uidByLegacyId.set(area.id, area.uid || randomUUID());
    }

    const incomingUids = new Set(uidByLegacyId.values());
    this.transaction(() => {
      const managedRows = this.db.prepare(`
        SELECT uid FROM locations
        WHERE country_uid = ? AND json_extract(metadata_json, '$.managedBy') = 'country-api'
      `).all(countryUid) as SqlRow[];
      const toDelete = managedRows.map((row) => String(row.uid)).filter((uid) => !incomingUids.has(uid));
      for (const uid of toDelete) {
        const externalChild = this.db.prepare(`
          SELECT 1 FROM locations
          WHERE parent_uid = ? AND json_extract(metadata_json, '$.managedBy') IS NOT 'country-api'
          LIMIT 1
        `).get(uid);
        if (externalChild) throw new Error(`Cannot delete location ${uid}; it has externally managed children`);
      }

      const externalChildOfManagedLocation = this.db.prepare(`
        SELECT child.uid
        FROM locations child
        JOIN locations parent ON parent.uid = child.parent_uid
        WHERE parent.country_uid = ?
          AND json_extract(parent.metadata_json, '$.managedBy') = 'country-api'
          AND json_extract(child.metadata_json, '$.managedBy') IS NOT 'country-api'
        LIMIT 1
      `).get(countryUid) as SqlRow | undefined;
      if (externalChildOfManagedLocation) {
        throw new Error('Cannot rebuild country-managed locations while externally managed descendants are attached');
      }

      this.db.prepare(`
        DELETE FROM locations
        WHERE country_uid = ? AND json_extract(metadata_json, '$.managedBy') = 'country-api'
      `).run(countryUid);

      const ordered = [...incoming].sort((a, b) => a.level - b.level || a.id - b.id);
      for (const area of ordered) {
        const parentUid = area.level === 1
          ? rootUid
          : area.parentUid || (area.parentAdminLevelId ? uidByLegacyId.get(area.parentAdminLevelId) : undefined);
        if (!parentUid) throw new Error(`${area.name} is missing a parent at level ${area.level - 1}`);
        this.insertLocationUnsafe({
          uid: uidByLegacyId.get(area.id),
          countryCode: country.countryCode,
          parentUid,
          levelOrder: area.level,
          name: area.name,
          type: this.getLevelName(country.countryCode, area.level),
          legacyId: area.id,
          metadata: { managedBy: 'country-api', office: area.office, leaders: area.leaders },
        });
      }
    });

    return this.getCountryByCode(country.countryCode) || savedCountry;
  }

  private getCountryRow(countryCodeOrUid: string): SqlRow | undefined {
    return this.db.prepare(`
      SELECT * FROM countries WHERE iso2 = upper(?) OR uid = ?
    `).get(countryCodeOrUid, countryCodeOrUid) as SqlRow | undefined;
  }

  private getLevelName(countryCode: string, order: number): string {
    const row = this.db.prepare(`
      SELECT level.name FROM hierarchy_levels level
      JOIN countries country ON country.uid = level.country_uid
      WHERE country.iso2 = upper(?) AND level.level_order = ?
    `).get(countryCode, order) as SqlRow | undefined;
    if (!row) throw new Error(`Hierarchy level ${order} is not configured for ${countryCode}`);
    return String(row.name);
  }

  getCountries(): Country[] {
    return (this.db.prepare('SELECT iso2 FROM countries ORDER BY legacy_id').all() as SqlRow[])
      .map((row) => this.getCountryByCode(String(row.iso2)))
      .filter((country): country is Country => Boolean(country));
  }

  getCountryByLegacyId(id: number): Country | null {
    const row = this.db.prepare('SELECT iso2 FROM countries WHERE legacy_id = ?').get(id) as SqlRow | undefined;
    return row ? this.getCountryByCode(String(row.iso2)) : null;
  }

  getCountryByCode(countryCode: string): Country | null {
    const row = this.getCountryRow(countryCode);
    if (!row) return null;
    const profile = parseJson<Partial<Country>>(row.profile_json, {});
    const levels = this.getHierarchy(String(row.iso2)).levels;
    const adminLevels = (this.db.prepare(`
      SELECT location.uid, location.legacy_id, location.name, location.depth,
             location.parent_uid, location.metadata_json
      FROM locations location
      WHERE location.country_uid = ?
        AND json_extract(location.metadata_json, '$.managedBy') = 'country-api'
      ORDER BY location.depth, location.name
    `).all(row.uid) as SqlRow[]).map((location) => {
      const metadata = parseJson<Record<string, unknown>>(location.metadata_json, {});
      const parent = location.parent_uid
        ? this.db.prepare('SELECT legacy_id FROM locations WHERE uid = ?').get(location.parent_uid) as SqlRow | undefined
        : undefined;
      return {
        id: Number(location.legacy_id),
        uid: String(location.uid),
        name: String(location.name),
        level: Number(location.depth),
        countryCode: String(row.iso2),
        parentAdminLevelId: parent?.legacy_id == null ? undefined : Number(parent.legacy_id),
        parentUid: Number(location.depth) === 1 ? String(row.root_location_uid) : String(location.parent_uid),
        office: metadata.office as AdminLevel['office'],
        leaders: metadata.leaders as AdminLevel['leaders'],
      } satisfies AdminLevel;
    });

    return {
      ...profile,
      id: Number(row.legacy_id),
      uid: String(row.uid),
      rootLocationUid: String(row.root_location_uid),
      name: String(row.name),
      countryCode: String(row.iso2),
      adminLevels,
      numberOfAdminLevels: levels.length,
      adminLevelNames: levels.map((level) => ({
        level: level.order,
        name: level.name,
        key: level.key,
        alternateNames: level.alternateNames,
        allowedTypes: level.allowedTypes,
      })),
    } as Country;
  }

  deleteCountry(id: number): boolean {
    return Number(this.db.prepare('DELETE FROM countries WHERE legacy_id = ?').run(id).changes) > 0;
  }

  getHierarchy(countryCode: string): LocationHierarchySchema {
    const country = this.getCountryRow(countryCode);
    if (!country) throw new Error(`Country not found: ${countryCode}`);
    const levels = (this.db.prepare(`
      SELECT * FROM hierarchy_levels WHERE country_uid = ? ORDER BY level_order
    `).all(country.uid) as SqlRow[]).map((row) => ({
      uid: String(row.uid),
      countryUid: String(row.country_uid),
      order: Number(row.level_order),
      key: String(row.level_key),
      name: String(row.name),
      alternateNames: parseJson<string[]>(row.alternate_names_json, []),
      allowedTypes: parseJson<string[]>(row.allowed_types_json, []),
      required: Boolean(row.is_required),
    } satisfies LocationHierarchyLevel));
    return {
      countryUid: String(country.uid),
      countryCode: String(country.iso2),
      countryName: String(country.name),
      rootLocationUid: String(country.root_location_uid),
      version: Number(country.hierarchy_version),
      levels,
    };
  }

  insertLocation(input: NewLocationInput, actor = 'api'): LocationRecord {
    return this.transaction(() => {
      const record = this.insertLocationUnsafe(input, true) as LocationRecord;
      this.db.prepare(`
        INSERT INTO location_audit_log(location_uid, action, actor, after_json)
        VALUES (?, 'create', ?, ?)
      `).run(record.uid, actor, JSON.stringify(record));
      return record;
    });
  }

  importLocations(inputs: NewLocationInput[], actor = 'import'): number {
    return this.transaction(() => {
      for (const input of inputs) this.insertLocationUnsafe(input, false);
      this.db.prepare(`
        INSERT INTO location_audit_log(location_uid, action, actor, after_json)
        VALUES (NULL, 'import', ?, ?)
      `).run(actor, JSON.stringify({ importedLocations: inputs.length }));
      return inputs.length;
    });
  }

  deleteLocationsByManager(countryCode: string, managedBy: string): number {
    const country = this.getCountryRow(countryCode);
    if (!country) throw new Error(`Country not found: ${countryCode}`);
    return this.transaction(() => Number(this.db.prepare(`
      DELETE FROM locations
      WHERE country_uid = ?
        AND depth > 0
        AND json_extract(metadata_json, '$.managedBy') = ?
    `).run(country.uid, managedBy).changes));
  }

  private insertLocationUnsafe(input: NewLocationInput, hydrate = true): LocationRecord | null {
    const country = this.getCountryRow(input.countryCode);
    if (!country) throw new Error(`Country not found: ${input.countryCode}`);
    const level = this.db.prepare(`
      SELECT * FROM hierarchy_levels WHERE country_uid = ? AND level_order = ?
    `).get(country.uid, input.levelOrder) as SqlRow | undefined;
    if (!level) throw new Error(`Level ${input.levelOrder} is not configured for ${input.countryCode}`);
    const name = requiredString(input.name, 'name');
    const uid = input.uid || randomUUID();
    this.db.prepare(`
      INSERT INTO locations(
        uid, country_uid, level_uid, parent_uid, legacy_id, depth, name, normalized_name,
        type_label, status, source_name, source_year, source_path, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid,
      country.uid,
      level.uid,
      input.parentUid,
      input.legacyId ?? null,
      input.levelOrder,
      name,
      normalizeLocationName(name),
      requiredString(input.type, 'type'),
      input.status || 'active',
      input.source?.name || null,
      input.source?.year || null,
      input.source?.path || null,
      JSON.stringify(input.metadata || {}),
    );
    if (!hydrate) return null;
    const record = this.getLocation(uid);
    if (!record) throw new Error(`Failed to insert location ${uid}`);
    return record;
  }

  getLocation(uid: string): LocationRecord | null {
    const row = this.db.prepare(`
      SELECT location.*, country.iso2, level.level_order, level.level_key, level.name AS level_name
      FROM locations location
      JOIN countries country ON country.uid = location.country_uid
      LEFT JOIN hierarchy_levels level ON level.uid = location.level_uid
      WHERE location.uid = ?
    `).get(uid) as SqlRow | undefined;
    return row ? this.rowToLocation(row) : null;
  }

  listLocations(countryCode: string, options: LocationListOptions = {}): { items: LocationRecord[]; total: number; limit: number; offset: number } {
    const country = this.getCountryRow(countryCode);
    if (!country) throw new Error(`Country not found: ${countryCode}`);
    const clauses = ['location.country_uid = ?'];
    const parameters: SQLInputValue[] = [country.uid];
    if (options.parentUid) {
      clauses.push('location.parent_uid = ?');
      parameters.push(options.parentUid);
    }
    if (options.levelOrder) {
      clauses.push('location.depth = ?');
      parameters.push(options.levelOrder);
    }
    if (options.search?.trim()) {
      clauses.push(`(location.normalized_name LIKE ? OR EXISTS (
        SELECT 1 FROM location_aliases alias
        WHERE alias.location_uid = location.uid AND alias.normalized_alias LIKE ?
      ))`);
      const query = `%${normalizeLocationName(options.search)}%`;
      parameters.push(query, query);
    }
    const where = clauses.join(' AND ');
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS count FROM locations location WHERE ${where}`).get(...parameters) as SqlRow).count);
    const limit = clampLimit(options.limit);
    const offset = Math.max(options.offset || 0, 0);
    const rows = this.db.prepare(`
      SELECT location.*, country.iso2, level.level_order, level.level_key, level.name AS level_name
      FROM locations location
      JOIN countries country ON country.uid = location.country_uid
      LEFT JOIN hierarchy_levels level ON level.uid = location.level_uid
      WHERE ${where}
      ORDER BY location.name, location.uid
      LIMIT ? OFFSET ?
    `).all(...parameters, limit, offset) as SqlRow[];
    return { items: rows.map((row) => this.rowToLocation(row)), total, limit, offset };
  }

  getAncestors(uid: string): LocationRecord[] {
    return (this.db.prepare(`
      SELECT location.*, country.iso2, level.level_order, level.level_key, level.name AS level_name
      FROM location_paths path
      JOIN locations location ON location.uid = path.ancestor_uid
      JOIN countries country ON country.uid = location.country_uid
      LEFT JOIN hierarchy_levels level ON level.uid = location.level_uid
      WHERE path.descendant_uid = ?
      ORDER BY path.depth DESC
    `).all(uid) as SqlRow[]).map((row) => this.rowToLocation(row));
  }

  getDescendants(uid: string, maxDepth?: number, limit = 1000, offset = 0): { items: LocationRecord[]; total: number } {
    const depthClause = maxDepth == null ? '' : 'AND path.depth <= ?';
    const params: SQLInputValue[] = maxDepth == null ? [uid] : [uid, maxDepth];
    const total = Number((this.db.prepare(`
      SELECT COUNT(*) AS count FROM location_paths path
      WHERE path.ancestor_uid = ? AND path.depth > 0 ${depthClause}
    `).get(...params) as SqlRow).count);
    const rows = this.db.prepare(`
      SELECT location.*, country.iso2, level.level_order, level.level_key, level.name AS level_name
      FROM location_paths path
      JOIN locations location ON location.uid = path.descendant_uid
      JOIN countries country ON country.uid = location.country_uid
      LEFT JOIN hierarchy_levels level ON level.uid = location.level_uid
      WHERE path.ancestor_uid = ? AND path.depth > 0 ${depthClause}
      ORDER BY location.depth, location.name
      LIMIT ? OFFSET ?
    `).all(...params, clampLimit(limit), Math.max(offset, 0)) as SqlRow[];
    return { items: rows.map((row) => this.rowToLocation(row)), total };
  }

  updateLocation(uid: string, patch: Partial<Pick<LocationRecord, 'name' | 'type' | 'status' | 'metadata'>>, actor = 'api'): LocationRecord {
    const before = this.getLocation(uid);
    if (!before) throw new Error('Location not found');
    if (before.levelOrder === 0) throw new Error('Country roots must be updated through the country API');
    const next = {
      name: patch.name == null ? before.name : requiredString(patch.name, 'name'),
      type: patch.type == null ? before.type : requiredString(patch.type, 'type'),
      status: patch.status || before.status,
      metadata: patch.metadata == null ? before.metadata : patch.metadata,
    };
    this.transaction(() => {
      this.db.prepare(`
        UPDATE locations SET name = ?, normalized_name = ?, type_label = ?, status = ?, metadata_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE uid = ?
      `).run(next.name, normalizeLocationName(next.name), next.type, next.status, JSON.stringify(next.metadata), uid);
      this.db.prepare(`
        INSERT INTO location_audit_log(location_uid, action, actor, before_json, after_json)
        VALUES (?, 'update', ?, ?, ?)
      `).run(uid, actor, JSON.stringify(before), JSON.stringify({ ...before, ...next }));
    });
    return this.getLocation(uid) as LocationRecord;
  }

  moveLocation(uid: string, newParentUid: string, actor = 'api'): LocationRecord {
    const location = this.getLocation(uid);
    const parent = this.getLocation(newParentUid);
    if (!location || !parent) throw new Error('Location or new parent not found');
    if (location.countryUid !== parent.countryUid) throw new Error('Cannot move a location across countries');
    if (parent.levelOrder !== location.levelOrder - 1) throw new Error('New parent must be at the immediately preceding level');
    const wouldCycle = this.db.prepare(`
      SELECT 1 FROM location_paths WHERE ancestor_uid = ? AND descendant_uid = ?
    `).get(uid, newParentUid);
    if (wouldCycle) throw new Error('Cannot move a location below its own descendant');

    this.transaction(() => {
      this.db.prepare(`
        DELETE FROM location_paths
        WHERE descendant_uid IN (SELECT descendant_uid FROM location_paths WHERE ancestor_uid = ?)
          AND ancestor_uid NOT IN (SELECT descendant_uid FROM location_paths WHERE ancestor_uid = ?)
      `).run(uid, uid);
      this.db.prepare(`UPDATE locations SET parent_uid = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE uid = ?`).run(newParentUid, uid);
      this.db.prepare(`
        INSERT INTO location_paths(country_uid, ancestor_uid, descendant_uid, depth)
        SELECT ?, super.ancestor_uid, subtree.descendant_uid, super.depth + subtree.depth + 1
        FROM location_paths super
        CROSS JOIN location_paths subtree
        WHERE super.descendant_uid = ? AND subtree.ancestor_uid = ?
      `).run(location.countryUid, newParentUid, uid);
      this.db.prepare(`
        INSERT INTO location_audit_log(location_uid, action, actor, before_json, after_json)
        VALUES (?, 'move', ?, ?, ?)
      `).run(uid, actor, JSON.stringify(location), JSON.stringify({ ...location, parentUid: newParentUid }));
    });
    return this.getLocation(uid) as LocationRecord;
  }

  deleteLocation(uid: string, cascade = false, actor = 'api'): void {
    const location = this.getLocation(uid);
    if (!location) throw new Error('Location not found');
    if (location.levelOrder === 0) throw new Error('Country roots cannot be deleted through the location API');
    const childCount = Number((this.db.prepare('SELECT COUNT(*) AS count FROM locations WHERE parent_uid = ?').get(uid) as SqlRow).count);
    if (childCount > 0 && !cascade) throw new Error('Location has children; pass cascade=true to delete its subtree');
    this.transaction(() => {
      this.db.prepare(`
        INSERT INTO location_audit_log(location_uid, action, actor, before_json)
        VALUES (?, 'delete', ?, ?)
      `).run(uid, actor, JSON.stringify(location));
      this.db.prepare('DELETE FROM locations WHERE uid = ?').run(uid);
    });
  }

  addAlias(locationUid: string, alias: string, locale?: string, sourceName?: string): void {
    const value = requiredString(alias, 'alias');
    this.db.prepare(`
      INSERT INTO location_aliases(uid, location_uid, alias, normalized_alias, locale, source_name)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_uid, normalized_alias, locale) DO UPDATE SET alias = excluded.alias, source_name = excluded.source_name
    `).run(randomUUID(), locationUid, value, normalizeLocationName(value), locale || null, sourceName || null);
  }

  upsertExternalId(locationUid: string, authority: string, externalId: string, sourceVersion?: string): void {
    if (!this.getLocation(locationUid)) throw new Error('Location not found');
    this.db.prepare(`
      INSERT INTO location_external_ids(location_uid, authority, external_id, source_version)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(authority, external_id, source_version)
      DO UPDATE SET location_uid = excluded.location_uid
    `).run(locationUid, requiredString(authority, 'authority'), requiredString(externalId, 'externalId'), sourceVersion || '');
  }

  upsertGeometry(input: LocationGeometry): void {
    if (!this.getLocation(input.locationUid)) throw new Error('Location not found');
    this.db.prepare(`
      INSERT INTO location_geometries(location_uid, geometry_type, geometry_json, bbox_json, source_name, source_version)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(location_uid) DO UPDATE SET
        geometry_type = excluded.geometry_type,
        geometry_json = excluded.geometry_json,
        bbox_json = excluded.bbox_json,
        source_name = excluded.source_name,
        source_version = excluded.source_version,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).run(
      input.locationUid,
      requiredString(input.type, 'type'),
      JSON.stringify(input.geometry),
      input.bbox ? JSON.stringify(input.bbox) : null,
      requiredString(input.sourceName, 'sourceName'),
      input.sourceVersion || null,
    );
  }

  getGeometry(locationUid: string): LocationGeometry | undefined {
    const row = this.db.prepare(`
      SELECT location_uid, geometry_type, geometry_json, bbox_json, source_name, source_version
      FROM location_geometries WHERE location_uid = ?
    `).get(locationUid) as SqlRow | undefined;
    if (!row) return undefined;
    return {
      locationUid: String(row.location_uid),
      type: String(row.geometry_type),
      geometry: parseJson<Record<string, unknown>>(row.geometry_json, {}),
      bbox: row.bbox_json == null ? undefined : parseJson<[number, number, number, number]>(row.bbox_json, undefined as never),
      sourceName: String(row.source_name),
      sourceVersion: row.source_version == null ? undefined : String(row.source_version),
    };
  }

  getStatistics(countryCode?: string): Record<string, number> {
    const scalar = (table: string, extraCondition?: string) => {
      const conditions: string[] = [];
      const parameters: SQLInputValue[] = [];
      if (countryCode) {
        conditions.push('country_uid = (SELECT uid FROM countries WHERE iso2 = upper(?))');
        parameters.push(countryCode);
      }
      if (extraCondition) conditions.push(extraCondition);
      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      return Number((this.db.prepare(
        `SELECT COUNT(*) AS count FROM ${table} ${where}`,
      ).get(...parameters) as SqlRow).count);
    };
    const row = {
      countries: countryCode ? (this.getCountryRow(countryCode) ? 1 : 0) : scalar('countries'),
      hierarchy_levels: scalar('hierarchy_levels'),
      locations: scalar('locations'),
      administrative_locations: scalar('locations', 'depth > 0'),
      hierarchy_paths: scalar('location_paths'),
    };
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
  }

  integrityCheck(): string[] {
    return (this.db.prepare('PRAGMA integrity_check').all() as SqlRow[]).map((row) => String(Object.values(row)[0]));
  }

  private rowToLocation(row: SqlRow): LocationRecord {
    return {
      uid: String(row.uid),
      countryUid: String(row.country_uid),
      countryCode: String(row.iso2),
      levelUid: row.level_uid == null ? null : String(row.level_uid),
      levelOrder: Number(row.level_order || 0),
      levelKey: row.level_key == null ? 'country' : String(row.level_key),
      levelName: row.level_name == null ? 'Country' : String(row.level_name),
      parentUid: row.parent_uid == null ? null : String(row.parent_uid),
      name: String(row.name),
      type: String(row.type_label),
      status: String(row.status) as LocationRecord['status'],
      source: row.source_name || row.source_year || row.source_path ? {
        name: row.source_name == null ? undefined : String(row.source_name),
        year: row.source_year == null ? undefined : Number(row.source_year),
        path: row.source_path == null ? undefined : String(row.source_path),
      } : undefined,
      metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    };
  }
}
