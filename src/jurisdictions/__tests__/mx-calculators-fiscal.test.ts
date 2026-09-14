import { describe, expect, it } from 'vitest';
import { computeDeadline, computeMonthlyIsr, computeSurcharges, computeVat, monthsOfDelay, mxFiscalCalculators, mxHolidays } from '../mx/calculators-fiscal';

describe('ISR mensual (art. 96 LISR)', () => {
  it('applies the bracket cuota fija plus the marginal rate', () => {
    const r = computeMonthlyIsr({ monthlyIncome: 20000 });
    // bracket 15,487.72: cuota 1,640.18 + 21.36 % × (20,000 − 15,487.72 + 0.01)
    expect(r.total).toBeCloseTo(1640.18 + (20000 - 15487.72 + 0.01) * 0.2136, 1);
    expect(r.lines).toHaveLength(3);
  });
  it('subtracts the employment subsidy only under the cap', () => {
    const low = computeMonthlyIsr({ monthlyIncome: 8000, applySubsidy: true });
    expect(low.lines.some((l) => l.label.startsWith('Subsidio'))).toBe(true);
    expect(low.total).toBeLessThan(computeMonthlyIsr({ monthlyIncome: 8000 }).total);
    const high = computeMonthlyIsr({ monthlyIncome: 30000, applySubsidy: true });
    expect(high.lines.some((l) => l.label.startsWith('Subsidio'))).toBe(false);
    expect(high.warnings.some((w) => w.includes('tope'))).toBe(true);
  });
  it('never returns negative tax', () => {
    expect(computeMonthlyIsr({ monthlyIncome: 100, applySubsidy: true }).total).toBeGreaterThanOrEqual(0);
    expect(computeMonthlyIsr({ monthlyIncome: -5 }).total).toBe(0);
  });
});

describe('IVA', () => {
  it('computes 16 % on the base and can back out VAT-inclusive amounts', () => {
    expect(computeVat({ amount: 1000, regime: 'general' }).total).toBe(1160);
    const incl = computeVat({ amount: 1160, regime: 'general', includesVat: true });
    expect(incl.lines[0]?.amount).toBe(1000);
    expect(incl.total).toBe(1160);
  });
  it('uses 8 % on the border and 0 for zero-rate and exempt', () => {
    expect(computeVat({ amount: 1000, regime: 'border' }).total).toBe(1080);
    expect(computeVat({ amount: 1000, regime: 'zero' }).total).toBe(1000);
    expect(computeVat({ amount: 1000, regime: 'exempt' }).lines[1]?.amount).toBe(0);
  });
});

describe('Recargos (art. 21 CFF)', () => {
  it('counts a fraction of a month as a whole month', () => {
    expect(monthsOfDelay('2026-01-17', '2026-01-18')).toBe(1);
    expect(monthsOfDelay('2026-01-17', '2026-03-17')).toBe(2);
    expect(monthsOfDelay('2026-01-17', '2026-03-18')).toBe(3);
    expect(monthsOfDelay('2026-01-17', '2026-01-10')).toBe(0);
  });
  it('applies the update factor before the surcharges', () => {
    const r = computeSurcharges({ amount: 10000, dueDate: '2026-01-17', paymentDate: '2026-04-17', updateFactor: 1.02 });
    expect(r.lines[1]?.amount).toBe(200);
    expect(r.lines[2]?.amount).toBeCloseTo(10200 * 0.0147 * 3, 2);
    expect(r.total).toBeCloseTo(10200 + 10200 * 0.0147 * 3, 2);
  });
});

describe('Plazos', () => {
  it('lists the mandatory rest days of art. 74 LFT for a year', () => {
    const d = mxHolidays(2026);
    expect(d).toContain('2026-01-01');
    expect(d).toContain('2026-02-02'); // primer lunes de febrero
    expect(d).toContain('2026-03-16'); // tercer lunes de marzo
    expect(d).toContain('2026-11-16'); // tercer lunes de noviembre
    expect(d).not.toContain('2026-10-01');
    expect(mxHolidays(2030)).toContain('2030-10-01');
  });
  it('skips weekends and holidays for business days and counts from the next day', () => {
    // Notified Friday 2026-01-30: 5 business days → Feb 2 (holiday), 3, 4, 5, 6, 9 → deadline 2026-02-09
    const r = computeDeadline({ startDate: '2026-01-30', days: 5, kind: 'business' });
    expect(r.deadline).toBe('2026-02-09');
    expect(r.skipped).toEqual(['2026-01-31', '2026-02-01', '2026-02-02', '2026-02-07', '2026-02-08']);
    expect(computeDeadline({ startDate: '2026-01-30', days: 5, kind: 'calendar' }).deadline).toBe('2026-02-04');
  });
  it('exposes the deadline as a text line through the calculator contract', () => {
    const calc = mxFiscalCalculators.find((c) => c.id === 'mx-plazos')!;
    const r = calc.compute({ startDate: '2026-01-30', days: 5, kind: 'business' });
    expect(r.lines[0]?.text).toBe('2026-02-09');
  });
});
