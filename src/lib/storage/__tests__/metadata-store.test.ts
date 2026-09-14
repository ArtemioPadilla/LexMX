import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';

import { MetadataStore } from '../metadata-store';
import type { DocumentLineage, LineageAudit, ChangeDetection, RAGMetadata } from '@/types/lineage';

function makeLineage(overrides: Partial<DocumentLineage> = {}): DocumentLineage {
  const version = {
    versionId: 'v1',
    versionNumber: '1.0',
    effectiveDate: new Date('2020-01-01'),
    publicationDate: new Date('2020-01-01'),
    isCurrentVersion: true
  };

  return {
    documentId: 'lfd-1',
    title: 'Ley Federal del Trabajo',
    shortTitle: 'LFT',
    type: 'law',
    hierarchy: 3,
    legalArea: 'labor',
    origin: {
      sourceInstitution: 'Diputados',
      sourceType: 'official',
      publicationDate: new Date('2020-01-01'),
      captureDate: new Date('2020-01-02'),
      captureMethod: 'automated',
      capturedBy: 'system'
    },
    versions: [version],
    currentVersion: version,
    custody: {
      sha256Hash: 'abc123',
      fileSize: 1024,
      mimeType: 'application/pdf',
      integrityVerified: true,
      lastIntegrityCheck: new Date('2020-01-02')
    },
    completeness: 0.9,
    accuracy: 0.95,
    lastQualityCheck: new Date('2020-01-02'),
    citationCount: 0,
    ...overrides
  };
}

function makeAudit(overrides: Partial<LineageAudit> = {}): LineageAudit {
  return {
    auditId: 'audit-1',
    documentId: 'lfd-1',
    timestamp: new Date('2020-01-03'),
    action: 'created',
    actor: 'system',
    ...overrides
  };
}

function makeChangeDetection(overrides: Partial<ChangeDetection> = {}): ChangeDetection {
  return {
    documentId: 'lfd-1',
    lastCheckDate: new Date('2020-01-01'),
    nextCheckDate: new Date('2020-01-08'),
    checkFrequency: 'weekly',
    changesDetected: false,
    notificationSent: false,
    autoUpdateEnabled: true,
    ...overrides
  };
}

function makeRagMetadata(overrides: Partial<RAGMetadata> = {}): RAGMetadata {
  return {
    ...makeLineage(),
    chunkingStrategy: 'article',
    chunkCount: 10,
    averageChunkSize: 512,
    embeddingModel: 'multilingual-e5-small',
    embeddingDate: new Date('2020-01-05'),
    embeddingVersion: '1.0',
    baseConfidence: 0.9,
    temporalPenalty: 0.1,
    effectiveConfidence: 0.8,
    keywords: [],
    legalConcepts: [],
    citedArticles: [],
    crossReferences: [],
    ...overrides
  };
}

function openRawDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('MetadataStore', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('creates the lexmx_metadata database (v1) with lineages, audits, changeDetection and ragMetadata stores', async () => {
    const store = new MetadataStore();
    await store.initialize();

    const rawDb = await openRawDb('lexmx_metadata');
    try {
      expect(rawDb.version).toBe(1);
      expect(Array.from(rawDb.objectStoreNames).sort()).toEqual([
        'audits',
        'changeDetection',
        'lineages',
        'ragMetadata'
      ]);
    } finally {
      rawDb.close();
    }
  });

  it('round-trips a lineage through storeLineage/getLineage and supports deleteLineage', async () => {
    const store = new MetadataStore();
    await store.initialize();

    const lineage = makeLineage();
    await store.storeLineage(lineage);

    const fetched = await store.getLineage(lineage.documentId);
    expect(fetched).toEqual(lineage);

    await store.deleteLineage(lineage.documentId);
    await expect(store.getLineage(lineage.documentId)).resolves.toBeNull();
  });

  it('queryLineages filters by legalArea, hierarchy and minConfidence', async () => {
    const store = new MetadataStore();
    await store.initialize();

    await store.storeLineage(makeLineage({ documentId: 'civil-1', legalArea: 'civil', hierarchy: 3, accuracy: 0.9 }));
    await store.storeLineage(makeLineage({ documentId: 'labor-1', legalArea: 'labor', hierarchy: 4, accuracy: 0.4 }));

    const byArea = await store.queryLineages({ legalArea: 'civil' });
    expect(byArea.map(l => l.documentId)).toEqual(['civil-1']);

    const byHierarchy = await store.queryLineages({ hierarchy: 4 });
    expect(byHierarchy.map(l => l.documentId)).toEqual(['labor-1']);

    const byConfidence = await store.queryLineages({ minConfidence: 0.8 });
    expect(byConfidence.map(l => l.documentId)).toEqual(['civil-1']);
  });

  it('storeAudit/getAuditHistory returns entries for a document, most recent first, honoring the limit', async () => {
    const store = new MetadataStore();
    await store.initialize();

    await store.storeAudit(makeAudit({ auditId: 'a1', timestamp: new Date('2020-01-01') }));
    await store.storeAudit(makeAudit({ auditId: 'a2', timestamp: new Date('2020-01-02') }));
    await store.storeAudit(makeAudit({ auditId: 'a3', timestamp: new Date('2020-01-03') }));

    const history = await store.getAuditHistory('lfd-1', 2);
    expect(history).toHaveLength(2);
    expect(history[0]?.auditId).toBe('a3');
    expect(history[1]?.auditId).toBe('a2');
  });

  it('round-trips RAG metadata and finds documents needing a confidence update', async () => {
    const store = new MetadataStore();
    await store.initialize();

    const stale = makeRagMetadata({ documentId: 'stale-doc', embeddingDate: new Date('2000-01-01') });
    const fresh = makeRagMetadata({ documentId: 'fresh-doc', embeddingDate: new Date() });
    await store.storeRAGMetadata(stale);
    await store.storeRAGMetadata(fresh);

    const fetched = await store.getRAGMetadata('stale-doc');
    expect(fetched?.documentId).toBe('stale-doc');

    const needingUpdate = await store.getDocumentsNeedingUpdate(365);
    expect(needingUpdate.map(m => m.documentId)).toEqual(['stale-doc']);
  });

  it('storeChangeDetection/getDocumentsToCheck returns only documents whose nextCheckDate has passed', async () => {
    const store = new MetadataStore();
    await store.initialize();

    await store.storeChangeDetection(makeChangeDetection({ documentId: 'due', nextCheckDate: new Date('2000-01-01') }));
    await store.storeChangeDetection(makeChangeDetection({ documentId: 'not-due', nextCheckDate: new Date('2999-01-01') }));

    const toCheck = await store.getDocumentsToCheck();
    expect(toCheck.map(c => c.documentId)).toEqual(['due']);
  });

  it('clearAll empties every store and exportMetadata reflects it', async () => {
    const store = new MetadataStore();
    await store.initialize();

    await store.storeLineage(makeLineage());
    await store.storeAudit(makeAudit());
    await store.storeChangeDetection(makeChangeDetection());
    await store.storeRAGMetadata(makeRagMetadata());

    await store.clearAll();

    const exported = await store.exportMetadata();
    expect(exported.lineages.size).toBe(0);
    expect(exported.audits).toHaveLength(0);
    expect(exported.changeDetection.size).toBe(0);
    expect(exported.ragMetadata.size).toBe(0);
  });

  it('rejects with "Database not initialized" when used before initialize (error path)', async () => {
    const store = new MetadataStore();

    await expect(store.getLineage('lfd-1')).rejects.toThrow('Database not initialized');
    await expect(store.storeLineage(makeLineage())).rejects.toThrow('Database not initialized');
  });
});
