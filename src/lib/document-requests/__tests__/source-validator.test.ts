import { describe, it, expect } from 'vitest';
import { SourceValidator } from '../source-validator';

describe('SourceValidator - official domains', () => {
  it('accepts a known official .gob.mx domain', async () => {
    const result = await SourceValidator.validateUrl(
      'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120724.pdf'
    );

    expect(result.isValid).toBe(true);
    expect(result.authority).toBe('Cámara de Diputados');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('rejects a domain that is not in the official sources list', async () => {
    const result = await SourceValidator.validateUrl('https://example.com/ley-federal-trabajo.pdf');

    expect(result.isValid).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.warnings).toContain('La fuente no pertenece a un dominio oficial conocido');
  });

  it('rejects a malformed URL without throwing', async () => {
    const result = await SourceValidator.validateUrl('not-a-url');

    expect(result.isValid).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('SourceValidator - SCJN tesis URLs (sjf2.scjn.gob.mx)', () => {
  it('recognizes the sjf2.scjn.gob.mx tesis detail URL pattern as official SCJN content', async () => {
    const result = await SourceValidator.validateUrl(
      'https://sjf2.scjn.gob.mx/detalle/tesis/2026018'
    );

    expect(result.isValid).toBe(true);
    expect(result.authority).toBe('Suprema Corte de Justicia de la Nación');
    // performDeepValidation recognizes '/tesis' in the path as tesis content.
    expect(result.metadata?.documentNumber).toBeUndefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('SourceValidator - rate limiting', () => {
  it('allows requests under the limit and blocks once exhausted', () => {
    const now = new Date();
    const requests = Array.from({ length: 5 }, () => ({
      userFingerprint: 'user-1',
      createdAt: now,
    }));

    const result = SourceValidator.checkRateLimit('user-1', requests);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('ignores requests from other users and outside the window', () => {
    const now = new Date();
    const hourAndAHalfAgo = new Date(now.getTime() - 90 * 60 * 1000);
    const requests = [
      { userFingerprint: 'user-1', createdAt: hourAndAHalfAgo }, // outside window
      { userFingerprint: 'user-2', createdAt: now }, // different user
    ];

    const result = SourceValidator.checkRateLimit('user-1', requests);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
