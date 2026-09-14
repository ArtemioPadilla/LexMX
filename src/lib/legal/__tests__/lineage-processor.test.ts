import { describe, it, expect } from 'vitest';
import { LineageProcessor } from '../lineage-processor';

describe('LineageProcessor.validateSource', () => {
  const processor = new LineageProcessor();

  it.each([
    'https://www.dof.gob.mx/nota_detalle.php',
    'https://www.scjn.gob.mx/tesis',
    'https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf',
  ])('marks %s as an official Mexican government source', async url => {
    const result = await processor.validateSource(url);

    expect(result.isOfficial).toBe(true);
    expect(result.trustScore).toBe(1.0);
    expect(result.officialDomain).toBeDefined();
  });

  it('rejects a non-official domain and lowers the trust score', async () => {
    const result = await processor.validateSource('https://www.blogdenoticias.com/reforma-laboral');

    expect(result.isOfficial).toBe(false);
    expect(result.trustScore).toBeLessThan(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('penalizes non-HTTPS sources while still recognizing an official domain', async () => {
    const result = await processor.validateSource('http://www.dof.gob.mx/nota');

    expect(result.isOfficial).toBe(true);
    expect(result.trustScore).toBeLessThan(1);
    expect(result.warnings.some(w => w.includes('HTTPS'))).toBe(true);
  });

  it('flags an unparsable URL as invalid with zero trust', async () => {
    const result = await processor.validateSource('not-a-valid-url');

    expect(result.isOfficial).toBe(false);
    expect(result.trustScore).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
