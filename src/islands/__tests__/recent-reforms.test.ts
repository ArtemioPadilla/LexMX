import { describe, expect, it } from 'vitest';
import { recentReforms } from '../RecentReformsIsland';

const docs = [
  { id: 'lft', title: 'LFT', lastReform: '2026-05-14' },
  { id: 'cff', title: 'CFF', lastReform: '2026-04-09' },
  { id: 'old', title: 'Old', lastReform: '2020-01-01' },
  { id: 'none', title: 'None', lastReform: null },
];

describe('recentReforms', () => {
  it('lists reforms newer than the last visit, newest first', () => {
    expect(recentReforms(docs, '2026-05-01', new Date('2026-09-14')).map((d) => d.id)).toEqual(['lft']);
    expect(recentReforms(docs, '2026-01-01', new Date('2026-09-14')).map((d) => d.id)).toEqual(['lft', 'cff']);
  });

  it('uses a 90-day window on the first visit', () => {
    expect(recentReforms(docs, null, new Date('2026-06-01')).map((d) => d.id)).toEqual(['lft', 'cff']);
    expect(recentReforms(docs, null, new Date('2026-09-14')).map((d) => d.id)).toEqual([]);
  });
});
