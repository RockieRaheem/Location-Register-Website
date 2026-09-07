import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { LocationHierarchyLevel, LocationHierarchySchema, LocationRecord } from '../types';

interface CountryDocument {
  uid: string;
  code: string;
  name: string;
  rootLocationUid: string;
  schemaVersion: number;
}

interface FirestoreLocation extends LocationRecord {
  normalizedName: string;
  ancestorUids: string[];
  createdBy?: string;
}

export interface FirebaseLocationQuery {
  parentUid?: string;
  levelOrder?: number;
  ancestorUid?: string;
  searchPrefix?: string;
  limit?: number;
}

function normalizeName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function referenceCode(countryCode: string, levelOrder: number, uid: string): string {
  return `${countryCode}-L${String(levelOrder).padStart(2, '0')}-${uid.replace(/-/g, '').toUpperCase()}`;
}

function locationFromDocument(snapshot: { id: string; data(): unknown }): LocationRecord {
  const data = snapshot.data() as FirestoreLocation;
  return { ...data, uid: snapshot.id };
}

export const firebaseLocationRegistryService = {
  async getSchema(countryCode: string): Promise<LocationHierarchySchema> {
    const code = countryCode.trim().toUpperCase();
    const countrySnapshot = await getDoc(doc(db, 'countries', code));
    if (!countrySnapshot.exists()) throw new Error(`Country ${code} is not available in Firebase.`);
    const country = countrySnapshot.data() as CountryDocument;
    const levelsSnapshot = await getDocs(query(collection(db, 'countries', code, 'hierarchyLevels'), orderBy('order')));
    return {
      countryUid: country.uid,
      countryCode: country.code,
      countryName: country.name,
      rootLocationUid: country.rootLocationUid,
      version: country.schemaVersion,
      levels: levelsSnapshot.docs.map((level) => ({ ...level.data(), uid: level.id } as LocationHierarchyLevel)),
    };
  },

  async getLocation(uid: string): Promise<LocationRecord> {
    const snapshot = await getDoc(doc(db, 'locations', uid));
    if (!snapshot.exists()) throw new Error(`Location ${uid} was not found.`);
    return locationFromDocument(snapshot);
  },

  async listLocations(countryCode: string, input: FirebaseLocationQuery = {}): Promise<{ items: LocationRecord[]; total: number }> {
    const relationshipFilters = [input.parentUid, input.levelOrder != null, input.ancestorUid].filter(Boolean).length;
    if (relationshipFilters > 1) throw new Error('Use only one of parentUid, levelOrder, or ancestorUid in a location query.');
    const constraints = [where('countryCode', '==', countryCode.trim().toUpperCase())];
    if (input.parentUid) constraints.push(where('parentUid', '==', input.parentUid));
    if (input.levelOrder != null) constraints.push(where('levelOrder', '==', input.levelOrder));
    if (input.ancestorUid) constraints.push(where('ancestorUids', 'array-contains', input.ancestorUid));

    const normalizedPrefix = input.searchPrefix ? normalizeName(input.searchPrefix) : '';
    if (normalizedPrefix) {
      constraints.push(where('normalizedName', '>=', normalizedPrefix));
      constraints.push(where('normalizedName', '<=', `${normalizedPrefix}\uf8ff`));
    }

    const baseQuery = query(collection(db, 'locations'), ...constraints);
    const [countSnapshot, resultSnapshot] = await Promise.all([
      getCountFromServer(baseQuery),
      getDocs(query(baseQuery, orderBy('normalizedName'), firestoreLimit(Math.min(Math.max(input.limit || 100, 1), 500)))),
    ]);
    return {
      items: resultSnapshot.docs.map(locationFromDocument),
      total: countSnapshot.data().count,
    };
  },

  async getAncestors(uid: string): Promise<LocationRecord[]> {
    const locationSnapshot = await getDoc(doc(db, 'locations', uid));
    if (!locationSnapshot.exists()) throw new Error(`Location ${uid} was not found.`);
    const ancestorUids = (locationSnapshot.data() as FirestoreLocation).ancestorUids || [];
    const snapshots = await Promise.all(ancestorUids.map((ancestorUid) => getDoc(doc(db, 'locations', ancestorUid))));
    return snapshots.filter((snapshot) => snapshot.exists()).map(locationFromDocument);
  },

  async createLocation(input: {
    countryCode: string;
    parentUid: string;
    name: string;
    type: string;
    metadata?: Record<string, unknown>;
  }): Promise<LocationRecord> {
    const code = input.countryCode.trim().toUpperCase();
    const uid = crypto.randomUUID();
    const newReference = doc(db, 'locations', uid);
    const schema = await firebaseLocationRegistryService.getSchema(code);

    await runTransaction(db, async (transaction) => {
      const parentSnapshot = await transaction.get(doc(db, 'locations', input.parentUid));
      if (!parentSnapshot.exists()) throw new Error('The selected parent location does not exist.');
      const parent = parentSnapshot.data() as FirestoreLocation;
      if (parent.countryCode !== code) throw new Error('A location cannot have a parent in another country.');

      const nextLevel = schema.levels.find((level) => level.order === parent.levelOrder + 1);
      if (!nextLevel) throw new Error('The selected parent cannot have another hierarchy level.');
      if (nextLevel.allowedTypes.length > 0 && !nextLevel.allowedTypes.includes(input.type)) {
        throw new Error(`${input.type} is not allowed at the ${nextLevel.name} level.`);
      }

      transaction.set(newReference, {
        uid,
        referenceCode: referenceCode(code, nextLevel.order, uid),
        countryUid: parent.countryUid,
        countryCode: code,
        levelUid: nextLevel.uid,
        levelOrder: nextLevel.order,
        levelKey: nextLevel.key,
        levelName: nextLevel.name,
        parentUid: input.parentUid,
        ancestorUids: [...(parent.ancestorUids || []), input.parentUid],
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        type: input.type,
        status: 'active',
        metadata: input.metadata || {},
        source: { name: 'Location Register application' },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return this.getLocation(uid);
  },

  async updateLocation(uid: string, patch: Partial<Pick<LocationRecord, 'name' | 'type' | 'status' | 'metadata'>>): Promise<void> {
    const safePatch: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
    if (patch.name != null) safePatch.normalizedName = normalizeName(patch.name);
    await updateDoc(doc(db, 'locations', uid), safePatch);
  },
};
