import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { markdownToDocx } from '../docx';

// setupTests installs a MockBlob (size 0 for binary parts) before every test;
// use Node's real Blob so the zip bytes can be asserted.
const jsdomBlob = globalThis.Blob;
beforeEach(() => {
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
});
afterEach(() => {
  globalThis.Blob = jsdomBlob;
});

const SAMPLE = `# Contrato

Entre **Juan Pérez** y María López.

- Cláusula primera
- Cláusula segunda

| Concepto | Monto |
|---|---|
| Renta | $10,000 |
`;

describe('markdownToDocx', () => {
  it('produces a Word document (zip) with the content', async () => {
    const blob = await markdownToDocx(SAMPLE, 'Contrato');
    expect(blob.size).toBeGreaterThan(1000);
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe('PK');
  });

  it('handles an empty document', async () => {
    const blob = await markdownToDocx('', 'Vacío');
    expect(blob.size).toBeGreaterThan(0);
  });
});
