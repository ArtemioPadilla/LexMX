import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentIngestionPipeline } from '../document-ingestion-pipeline';
import type { DocumentRequest } from '@/types/legal';

describe('DocumentIngestionPipeline', () => {
  let pipeline: DocumentIngestionPipeline;

  beforeEach(() => {
    pipeline = new DocumentIngestionPipeline();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(pipeline).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customPipeline = new DocumentIngestionPipeline({
        chunkSize: 1024,
        chunkOverlap: 100,
        preserveStructure: false
      });
      expect(customPipeline).toBeDefined();
    });
  });

  describe('ingestFromUrl', () => {
    it('should process URL and create document request', async () => {
      const url = 'https://www.dof.gob.mx/test-document';
      const mockMetadata = {
        title: 'Test Document',
        type: 'law' as const
      };

      // Mock the fetcher to avoid actual network calls
      vi.spyOn(pipeline as any, 'ingestFromRequest').mockResolvedValue({
        success: true,
        documentId: 'test-id',
        stats: {
          fetchTime: 100,
          parseTime: 50,
          chunkTime: 30,
          embeddingTime: 200,
          totalTime: 380,
          chunkCount: 5,
          tokenCount: 1500
        }
      });

      const result = await pipeline.ingestFromUrl(url, mockMetadata);
      
      expect(result.success).toBe(true);
      expect(result.documentId).toBe('test-id');
    });

    it('should detect official sources', async () => {
      const officialUrl = 'https://www.dof.gob.mx/document';
      const isOfficial = (pipeline as any).isOfficialSource(officialUrl);
      expect(isOfficial).toBe(true);
    });

    it('should detect non-official sources', async () => {
      const unofficialUrl = 'https://example.com/document';
      const isOfficial = (pipeline as any).isOfficialSource(unofficialUrl);
      expect(isOfficial).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel ongoing ingestion', () => {
      const mockAbort = vi.fn();
      (pipeline as any).abortController = { abort: mockAbort };
      
      pipeline.cancel();
      
      expect(mockAbort).toHaveBeenCalled();
    });
  });

  describe('progress events', () => {
    it('should emit progress events', () => {
      return new Promise<void>((resolve) => {
        pipeline.on('progress', (event) => {
          expect(event).toHaveProperty('stage');
          expect(event).toHaveProperty('progress');
          expect(event).toHaveProperty('message');
          expect(event).toHaveProperty('timestamp');
          resolve();
        });

        // Trigger a progress event
        (pipeline as any).emitProgress('fetching', 50, 'Test message');
      });
    });
  });

  describe('batch processing', () => {
    it('should process multiple documents in batch', async () => {
      const requests: DocumentRequest[] = [
        {
          id: '1',
          title: 'Document 1',
          type: 'law',
          sources: [{
            id: 'source1',
            type: 'url',
            url: 'https://test.com/doc1',
            verified: false,
            isOfficial: false
          }],
          status: 'pending',
          priority: 5,
          requestedBy: 'test-user',
          createdAt: new Date().toISOString(),
          hierarchy: 3,
          primaryArea: 'civil'
        }
      ];

      // Mock the ingest method
      vi.spyOn(pipeline, 'ingestFromRequest').mockResolvedValue({
        success: true,
        stats: {
          fetchTime: 100,
          parseTime: 50,
          chunkTime: 30,
          embeddingTime: 200,
          totalTime: 380,
          chunkCount: 5,
          tokenCount: 1500
        }
      });

      const results = await pipeline.ingestBatch(requests);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('helper methods', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test text with approximately 10 words here.';
      const tokens = (pipeline as any).estimateTokens(text);
      
      // Rough estimate: 1 token ≈ 4 characters
      const expectedTokens = Math.ceil(text.length / 4);
      expect(tokens).toBe(expectedTokens);
    });

    it('should create batches correctly', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batches = (pipeline as any).createBatches(items, 3);
      
      expect(batches).toHaveLength(4);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7, 8, 9]);
      expect(batches[3]).toEqual([10]);
    });
  });
});