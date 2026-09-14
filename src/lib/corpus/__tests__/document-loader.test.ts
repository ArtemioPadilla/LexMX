import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentLoader } from '../document-loader';
import type { LegalDocument } from '@/types/legal';

function jsonResponse(body: unknown, ok = true, statusText = 'OK'): Response {
  return {
    ok,
    statusText,
    json: () => Promise.resolve(body),
  } as Response;
}

const sampleDocument: LegalDocument = {
  id: 'cpeum',
  title: 'Constitución Política de los Estados Unidos Mexicanos',
  shortTitle: 'CPEUM',
  type: 'constitution',
  hierarchy: 1,
  primaryArea: 'constitutional',
  secondaryAreas: [],
  authority: 'Cámara de Diputados',
  publicationDate: '1917-02-05',
  status: 'active',
  territorialScope: 'federal',
  applicability: 'Nacional',
  relatedDependencies: [],
  importance: 'critical',
  updateFrequency: 'medium',
  content: [
    { id: 'cpeum-art-1', type: 'article', number: '1', content: 'Artículo 1 constitucional.' },
  ],
};

const sampleMetadata = {
  version: '1.0.0',
  buildDate: '2025-08-18T19:47:39.874Z',
  totalDocuments: 1,
  documents: [
    {
      id: 'cpeum',
      title: sampleDocument.title,
      type: sampleDocument.type,
      hierarchy: sampleDocument.hierarchy,
      primaryArea: sampleDocument.primaryArea,
      source: 'cpeum.txt',
      size: 100,
      lastUpdated: sampleDocument.publicationDate,
    },
  ],
};

describe('corpus DocumentLoader', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  it('loads corpus metadata, then hydrates a document by id', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse(sampleMetadata))
      .mockResolvedValueOnce(jsonResponse(sampleDocument));

    const loader = new DocumentLoader();
    const doc = await loader.loadDocument('cpeum');

    expect(doc?.id).toBe('cpeum');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [metadataCall, documentCall] = vi.mocked(global.fetch).mock.calls;
    expect(String(metadataCall?.[0])).toContain('metadata.json');
    expect(String(documentCall?.[0])).toContain('cpeum.json');
  });

  it('falls back to an empty corpus when the metadata request 404s', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({}, false, 'Not Found'));

    const loader = new DocumentLoader();
    const docs = await loader.loadAllDocuments();

    expect(docs).toEqual([]);
    expect(loader.getMetadata()?.totalDocuments).toBe(0);
  });

  it('falls back to an empty corpus when the metadata request throws a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('network down'));

    const loader = new DocumentLoader();
    await loader.initialize();

    expect(loader.getMetadata()).toEqual(
      expect.objectContaining({ totalDocuments: 0, documents: [] })
    );
  });
});

describe('corpus DocumentLoader · embeddings layouts', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  it('fetches one shard per document with the per-document layout', async () => {
    const loader = new DocumentLoader();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ version: '2.1.0', layout: 'per-document', batchFiles: 0, documents: { cpeum: { file: 'by-document/cpeum.json', count: 1 } } }))
      .mockResolvedValueOnce(jsonResponse([{ id: 'cpeum_chunk_0', embedding: [0.1, 0.2] }]));

    const embeddings = await loader.loadDocumentEmbeddings('cpeum');
    expect([...embeddings.keys()]).toEqual(['cpeum_chunk_0']);
    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/embeddings\/index\.json$/),
      expect.stringMatching(/embeddings\/by-document\/cpeum\.json$/),
    ]);

    // The index is cached and a document without a shard costs no fetch.
    expect((await loader.loadDocumentEmbeddings('lft')).size).toBe(0);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to loading legacy batches and filtering by document prefix', async () => {
    const loader = new DocumentLoader();
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ version: '1.0.0', batchFiles: 1 }))
      .mockResolvedValueOnce(jsonResponse([
        { id: 'cpeum_chunk_0', embedding: [1] },
        { id: 'lft_chunk_0', embedding: [2] },
      ]));

    const embeddings = await loader.loadDocumentEmbeddings('lft');
    expect([...embeddings.entries()]).toEqual([['lft_chunk_0', [2]]]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('builds a corpus version from version, buildDate and checksum', async () => {
    const loader = new DocumentLoader();
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ ...sampleMetadata, checksum: 'abc123' }));
    await loader.initialize();
    expect(loader.getCorpusVersion()).toBe('1.0.0|2025-08-18T19:47:39.874Z|abc123');
  });

  it('resolves secondary corpora under corpus/<code>/ and keeps Mexico at the root', async () => {
    const { documentLoader, loaderForJurisdiction, DocumentLoader } = await import('../document-loader');
    expect(loaderForJurisdiction('mx')).toBe(documentLoader);
    const cl = loaderForJurisdiction('cl');
    expect(cl).toBe(loaderForJurisdiction('cl'));
    expect(cl.paths.corpus.endsWith('corpus/cl/legal-corpus/')).toBe(true);
    expect(cl.paths.embeddings.endsWith('corpus/cl/embeddings/')).toBe(true);
    expect(new DocumentLoader().paths.corpus.endsWith('/legal-corpus/')).toBe(true);
    expect(new DocumentLoader().paths.corpus).not.toContain('/corpus/');
  });
});
