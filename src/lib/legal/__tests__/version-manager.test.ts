import { describe, it, expect } from 'vitest';
import { VersionManager } from '../version-manager';
import type { LegalVersion } from '@/types/lineage';
import type { LegalDocument, LegalContent } from '@/types/legal';

function buildDocument(content: LegalContent[]): LegalDocument {
  return {
    id: 'lft',
    title: 'Ley Federal del Trabajo',
    shortTitle: 'LFT',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'labor',
    secondaryAreas: [],
    authority: 'Cámara de Diputados',
    publicationDate: '1970-04-01',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'Nacional',
    relatedDependencies: [],
    importance: 'high',
    updateFrequency: 'medium',
    content,
  };
}

describe('VersionManager', () => {
  const manager = new VersionManager();

  it('creates a version entry marked as current', () => {
    const version = manager.createVersion({
      documentId: 'lft',
      versionNumber: '2024.1',
      effectiveDate: new Date('2024-01-01'),
      publicationDate: new Date('2023-12-15'),
      reformType: 'reforma',
      reformedArticles: ['47'],
    });

    expect(version.versionId).toContain('lft_v_');
    expect(version.isCurrentVersion).toBe(true);
    expect(version.reformedArticles).toEqual(['47']);
  });

  it('finds the most recent reform among several versions', () => {
    const versions: LegalVersion[] = [
      manager.createVersion({
        documentId: 'lft',
        versionNumber: '2022.1',
        effectiveDate: new Date('2022-01-01'),
        publicationDate: new Date('2021-12-01'),
        reformType: 'reforma',
      }),
      manager.createVersion({
        documentId: 'lft',
        versionNumber: '2023.1',
        effectiveDate: new Date('2023-06-01'),
        publicationDate: new Date('2023-05-01'),
        reformType: 'adicion',
      }),
    ];

    const summary = manager.generateReformSummary(versions);

    expect(summary.totalReforms).toBe(2);
    expect(summary.mostRecentReform?.versionNumber).toBe('2023.1');
    expect(summary.averageTimeBetweenReforms).toBeGreaterThan(0);
  });

  it('produces a line-level diff distinguishing additions, removals and unchanged lines', () => {
    const diff = manager.generateTextDiff(
      'Artículo 1. Texto original.\nArtículo 2. Sin cambios.',
      'Artículo 1. Texto reformado.\nArtículo 2. Sin cambios.',
      'line'
    );

    expect(diff.some(part => part.type === 'removed' && part.value.includes('original'))).toBe(true);
    expect(diff.some(part => part.type === 'added' && part.value.includes('reformado'))).toBe(true);
    expect(
      diff.some(part => part.type === 'unchanged' && part.value.includes('Sin cambios'))
    ).toBe(true);
  });

  it('detects added, removed and modified articles between two document versions', () => {
    const base = buildDocument([
      { id: 'a1', type: 'article', number: '1', content: 'Texto original del artículo 1.' },
      { id: 'a2', type: 'article', number: '2', content: 'Texto del artículo 2.' },
    ]);
    const updated = buildDocument([
      { id: 'a1', type: 'article', number: '1', content: 'Texto reformado del artículo 1.' },
      { id: 'a3', type: 'article', number: '3', content: 'Texto nuevo del artículo 3.' },
    ]);

    const { changes, summary } = manager.compareVersions(base, updated);

    expect(summary.articlesModified).toBe(1);
    expect(summary.articlesAdded).toBe(1);
    expect(summary.articlesRemoved).toBe(1);
    expect(changes).toHaveLength(3);
  });
});
