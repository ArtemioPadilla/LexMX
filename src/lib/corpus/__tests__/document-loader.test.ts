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
