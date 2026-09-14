import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';

import { IndexedDBVectorStore } from '../indexeddb-vector-store';
import type { VectorDocument } from '@/types/rag';

function makeDocument(overrides: Partial<VectorDocument> = {}): VectorDocument {
  return {
    id: 'ccf-art-1',
    content: 'Las disposiciones de este Código regulan el Distrito Federal.',
    // 4-dim embedding keeps assertions readable; the store doesn't care about size.
    embedding: [0.5, -0.5, 1, -1],
    metadata: {
      title: 'Código Civil Federal',
      type: 'code',
      legalArea: 'civil',
      hierarchy: 3,
      lastUpdated: '2020-01-01T00:00:00.000Z'
    },
    ...overrides
  };
}

// Opens a fresh raw connection to inspect what the store actually persisted,
// independent of the class under test.
function openRawDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('IndexedDBVectorStore', () => {
  beforeEach(() => {
    // Fresh in-memory IndexedDB per test so documents from one test never
    // leak into the next.
    globalThis.indexedDB = new IDBFactory();
  });

  it('creates the lexmx_vectors database (v1) with documents, embeddings and metadata stores', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    const rawDb = await openRawDb('lexmx_vectors');
    try {
      expect(rawDb.version).toBe(1);
      expect(Array.from(rawDb.objectStoreNames).sort()).toEqual(['documents', 'embeddings', 'metadata']);
    } finally {
      rawDb.close();
    }
  });

  it('round-trips a document through addDocument/getDocument, preserving id/content/metadata and a close embedding', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    const doc = makeDocument();
    await store.addDocument(doc);

    const fetched = await store.getDocument(doc.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(doc.id);
    expect(fetched?.content).toBe(doc.content);
    expect(fetched?.metadata).toEqual(doc.metadata);
    // Embeddings are quantized to int8 for storage, so allow a small tolerance.
    doc.embedding.forEach((value, i) => {
      expect(fetched?.embedding[i]).toBeCloseTo(value, 1);
    });
  });

  it('getDocument returns null for an unknown id', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    await expect(store.getDocument('does-not-exist')).resolves.toBeNull();
  });

  it('search returns documents above the score threshold, sorted by descending score', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    const close = makeDocument({ id: 'close', embedding: [1, 0, 0, 0] });
    const far = makeDocument({ id: 'far', embedding: [-1, 0, 0, 0] });
    await store.addDocuments([close, far]);

    const results = await store.search([1, 0, 0, 0], { scoreThreshold: 0.5 });

    expect(results.map(r => r.id)).toEqual(['close']);
    expect(results[0]?.score).toBeGreaterThan(0.9);
  });

  it('search applies the metadata filter', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    const civil = makeDocument({ id: 'civil-doc', embedding: [1, 0, 0, 0] });
    const labor = makeDocument({
      id: 'labor-doc',
      embedding: [1, 0, 0, 0],
      metadata: { ...makeDocument().metadata, legalArea: 'labor' }
    });
    await store.addDocuments([civil, labor]);

    const results = await store.search([1, 0, 0, 0], {
      scoreThreshold: 0,
      filter: { legalArea: 'labor' }
    });

    expect(results.map(r => r.id)).toEqual(['labor-doc']);
  });

  it('deleteDocument removes both the document and its embedding', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    const doc = makeDocument();
    await store.addDocument(doc);
    await store.deleteDocument(doc.id);

    await expect(store.getDocument(doc.id)).resolves.toBeNull();
    const stats = await store.getStats();
    expect(stats.documentCount).toBe(0);
  });

  it('clear empties documents, embeddings and metadata', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    await store.addDocuments([makeDocument({ id: 'a' }), makeDocument({ id: 'b' })]);
    await store.clear();

    const stats = await store.getStats();
    expect(stats.documentCount).toBe(0);
  });

  it('searchByMetadata matches on legalArea without needing an embedding', async () => {
    const store = new IndexedDBVectorStore();
    await store.initialize();

    await store.addDocument(makeDocument({ id: 'civil-doc' }));

    const results = await store.searchByMetadata({ legalArea: 'civil' });
    expect(results.map(r => r.id)).toEqual(['civil-doc']);

    const noMatch = await store.searchByMetadata({ legalArea: 'labor' });
    expect(noMatch).toEqual([]);
  });

  it('throws when used before initialize (error path)', async () => {
    const store = new IndexedDBVectorStore();

    await expect(store.getDocument('any-id')).rejects.toThrow('Vector store not initialized');
    await expect(store.search([1, 0], {})).rejects.toThrow('Vector store not initialized');
    await expect(store.addDocument(makeDocument())).rejects.toThrow('Vector store not initialized');
  });
});
