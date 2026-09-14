import { describe, expect, it } from 'vitest';
import { mx } from '../mx';
import { renderTemplate, templatePlaceholders } from '../_shared/templates';

describe('document templates', () => {
  it('every Mexican template declares all its placeholders as fields and cites a basis', () => {
    for (const t of mx.templates ?? []) {
      const names = t.fields.map((f) => f.name);
      for (const p of templatePlaceholders(t.body)) expect(names, `${t.id}: ${p}`).toContain(p);
      expect(t.basis.length).toBeGreaterThan(0);
      expect(t.body).toMatch(/Ley|C[óo]digo|constitucional/);
    }
    expect((mx.templates ?? []).map((t) => t.id)).toContain('mx-carta-poder-simple');
  });

  it('renders values and marks missing fields visibly', () => {
    const t = (mx.templates ?? []).find((x) => x.id === 'mx-carta-poder-simple')!;
    const r = renderTemplate(t, { otorgante: 'Ana', apoderado: 'Luis', ciudad: 'Guadalajara' });
    expect(r.markdown).toContain('**Ana** otorga a **Luis**');
    expect(r.markdown).toContain('[Actos concretos que se autorizan]');
    expect(r.missing).toEqual(expect.arrayContaining(['facultades', 'fecha', 'testigo1', 'testigo2']));
    expect(r.missing).not.toContain('otorgante');
  });
});
