/**
 * IndexedDB store for expedientes (plan Fase 5): `LexMX_Cases` v1, object
 * store `cases` keyed by id. Replaces `localStorage['lexmx_cases']`, which
 * is read once and imported (the key is left in place so an older build can
 * still open it; see docs/DATA-COMPATIBILITY.md).
 */
import type { LegalCase } from '@/types/cases';

export const CASES_DB_NAME = 'LexMX_Cases';
export const CASES_DB_VERSION = 1;
export const CASES_STORE = 'cases';
export const LEGACY_KEY = 'lexmx_cases';
export const MIGRATION_FLAG = 'lexmx_cases_migrated_v1';

type Serialized = Omit<LegalCase, 'createdAt' | 'updatedAt' | 'documents' | 'notes' | 'deadlines' | 'statusChanges'> & {
  createdAt: string;
  updatedAt: string;
  documents: Array<Omit<LegalCase['documents'][number], 'uploadedAt'> & { uploadedAt: string }>;
  notes: Array<Omit<LegalCase['notes'][number], 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }>;
  deadlines: Array<Omit<LegalCase['deadlines'][number], 'date'> & { date: string }>;
  statusChanges: Array<Omit<LegalCase['statusChanges'][number], 'date'> & { date: string }>;
};

const iso = (d: Date | string | number | undefined): string => (d instanceof Date ? d : new Date(d ?? Date.now())).toISOString();
const date = (s: string | Date | number | undefined): Date => {
  const d = s instanceof Date ? s : new Date(s ?? Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export function serializeCase(c: LegalCase): Serialized {
  return {
    ...c,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
    documents: c.documents.map((d) => ({ ...d, uploadedAt: iso(d.uploadedAt) })),
    notes: c.notes.map((n) => ({ ...n, createdAt: iso(n.createdAt), updatedAt: iso(n.updatedAt) })),
    deadlines: c.deadlines.map((d) => ({ ...d, date: iso(d.date) })),
    statusChanges: (c.statusChanges ?? []).map((s) => ({ ...s, date: iso(s.date) })),
  };
}

/** Accepts the current shape and the legacy localStorage shape (missing fields, string dates). */
export function deserializeCase(raw: Partial<Serialized> & { id: string }): LegalCase {
  return {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.description ?? '',
    client: raw.client,
    caseNumber: raw.caseNumber,
    legalArea: (raw.legalArea ?? 'civil') as LegalCase['legalArea'],
    jurisdiction: raw.jurisdiction ?? 'mx',
    status: (raw.status ?? 'active') as LegalCase['status'],
    createdAt: date(raw.createdAt),
    updatedAt: date(raw.updatedAt),
    documents: (raw.documents ?? []).map((d) => ({ ...d, tags: d.tags ?? [], uploadedAt: date(d.uploadedAt) })),
    notes: (raw.notes ?? []).map((n) => ({ ...n, tags: n.tags ?? [], createdAt: date(n.createdAt), updatedAt: date(n.updatedAt ?? n.createdAt) })),
    conversations: raw.conversations ?? [],
    deadlines: (raw.deadlines ?? []).map((d) => ({ ...d, completed: Boolean(d.completed), date: date(d.date) })),
    parties: raw.parties ?? [],
    summary: raw.summary,
    statusChanges: (raw.statusChanges ?? []).map((s) => ({ ...s, date: date(s.date) })),
  };
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(CASES_DB_NAME, CASES_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CASES_STORE)) {
        const store = db.createObjectStore(CASES_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('status', 'status');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open LexMX_Cases'));
  });
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class CaseStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= open();
    return this.dbPromise;
  }

  /** Imports `localStorage['lexmx_cases']` once. Returns how many cases were imported. */
  async migrateFromLocalStorage(): Promise<number> {
    if (typeof localStorage === 'undefined') return 0;
    if (localStorage.getItem(MIGRATION_FLAG)) return 0;
    const raw = localStorage.getItem(LEGACY_KEY);
    let imported = 0;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Array<Partial<Serialized> & { id: string }>;
        const existing = new Set((await this.list()).map((c) => c.id));
        for (const item of parsed) {
          if (!item?.id || existing.has(item.id)) continue;
          await this.put(deserializeCase(item));
          imported++;
        }
      } catch (error) {
        console.warn('Case migration: could not parse legacy cases', error);
      }
    }
    localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
    return imported;
  }

  async list(): Promise<LegalCase[]> {
    const db = await this.db();
    const store = db.transaction(CASES_STORE).objectStore(CASES_STORE);
    const rows = await request(store.getAll() as IDBRequest<Serialized[]>);
    return rows.map(deserializeCase).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async get(id: string): Promise<LegalCase | null> {
    const db = await this.db();
    const row = await request(db.transaction(CASES_STORE).objectStore(CASES_STORE).get(id) as IDBRequest<Serialized | undefined>);
    return row ? deserializeCase(row) : null;
  }

  async put(c: LegalCase): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CASES_STORE, 'readwrite');
    tx.objectStore(CASES_STORE).put(serializeCase(c));
    await done(tx);
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CASES_STORE, 'readwrite');
    tx.objectStore(CASES_STORE).delete(id);
    await done(tx);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(CASES_STORE, 'readwrite');
    tx.objectStore(CASES_STORE).clear();
    await done(tx);
  }
}

export const caseStore = new CaseStore();
