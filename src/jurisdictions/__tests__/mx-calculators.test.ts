import { describe, expect, it } from 'vitest';
import { computeSeverance, vacationDays } from '../mx/calculators';
import { mx } from '../mx';

describe('LFT vacation days (artículo 76, reforma 2022)', () => {
  it('follows the 12/14/16/18/20 ladder and +2 every 5 years', () => {
    expect([1, 2, 3, 4, 5, 6, 10, 11, 16].map(vacationDays)).toEqual([12, 14, 16, 18, 20, 22, 22, 24, 26]);
    expect(vacationDays(0)).toBe(0);
  });
});

describe('finiquito y liquidación', () => {
  const base = { dailyWage: 500, startDate: '2023-01-01', endDate: '2025-12-31' };

  it('computes a resignation finiquito without severance', () => {
    const r = computeSeverance({ ...base, kind: 'renuncia' });
    const labels = r.lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith('Aguinaldo proporcional'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Vacaciones proporcionales'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Prima vacacional'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Indemnización'))).toBe(false);
    expect(labels.some((l) => l.startsWith('Prima de antigüedad'))).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/15 años/);
    // full year worked in 2025: 15 days of aguinaldo at 500
    expect(r.lines.find((l) => l.label.startsWith('Aguinaldo'))?.amount).toBe(7500);
  });

  it('adds constitutional indemnity, 20 days per year and seniority on unfair dismissal', () => {
    const r = computeSeverance({ ...base, kind: 'despido-injustificado' });
    const get = (p: string) => r.lines.find((l) => l.label.startsWith(p))?.amount ?? 0;
    expect(get('Indemnización constitucional')).toBe(45000);
    expect(get('Veinte días')).toBeCloseTo(500 * 20 * (1096 / 365), 0);
    // seniority wage capped at 2 × minimum (630.08) < 500? no: 500 < 630.08 so uncapped
    expect(get('Prima de antigüedad')).toBeCloseTo(500 * 12 * (1096 / 365), 0);
    expect(r.total).toBeGreaterThan(45000);
    expect(r.lines.every((l) => /Ley Federal del Trabajo|constitucional/.test(l.basis))).toBe(true);
  });

  it('caps the seniority wage at twice the minimum wage', () => {
    const r = computeSeverance({ dailyWage: 2000, startDate: '2020-01-01', endDate: '2025-01-01', kind: 'despido-injustificado' });
    const line = r.lines.find((l) => l.label.startsWith('Prima de antigüedad'));
    expect(line?.note).toMatch(/dos salarios mínimos/);
    expect(line?.amount).toBeCloseTo(630.08 * 12 * (1828 / 365), 0);
  });

  it('rejects inverted dates and warns below the minimum wage', () => {
    expect(computeSeverance({ ...base, startDate: '2026-01-01', endDate: '2025-01-01', kind: 'renuncia' }).warnings[0]).toMatch(/inválidas/);
    expect(computeSeverance({ ...base, dailyWage: 100, kind: 'renuncia' }).warnings.join(' ')).toMatch(/menor al mínimo/);
  });

  it('is exposed through the jurisdiction module', () => {
    expect(mx.calculators?.map((c) => c.id)).toEqual(['mx-finiquito-liquidacion', 'mx-isr-mensual', 'mx-iva', 'mx-recargos', 'mx-plazos']);
    expect(mx.calculators?.[0]?.parameters.salarioMinimoGeneral?.asOf).toBe('2026-01-01');
  });
});
