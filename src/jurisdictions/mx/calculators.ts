/**
 * Calculadoras laborales de México (plan § 11.4 C): finiquito y liquidación
 * conforme a la Ley Federal del Trabajo. Deterministas, con fundamento por
 * línea y parámetros fechados. Son orientación: el cálculo definitivo
 * depende del salario integrado, prestaciones superiores y el caso concreto.
 */
import type { Calculator, CalculatorLine, CalculatorResult } from '../types';

/** Salario mínimo general diario 2026 (CONASAMI, DOF 12-dic-2025). Verificar cada enero. */
export const MX_PARAMETERS = {
  salarioMinimoGeneral: { value: 315.04, asOf: '2026-01-01', source: 'CONASAMI · DOF 12-12-2025' },
  salarioMinimoFrontera: { value: 440.87, asOf: '2026-01-01', source: 'CONASAMI · DOF 12-12-2025' },
  uma: { value: 117.31, asOf: '2026-02-01', source: 'INEGI · DOF 09-01-2026' },
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Días de vacaciones por año de servicio (artículo 76 LFT, reforma DOF 27-12-2022). */
export function vacationDays(yearsCompleted: number): number {
  if (yearsCompleted < 1) return 0;
  if (yearsCompleted <= 5) return 12 + (yearsCompleted - 1) * 2; // 12,14,16,18,20
  return 20 + 2 * Math.floor((yearsCompleted - 1) / 5 - 0); // 22 for years 6-10, 24 for 11-15…
}

export interface SeveranceInput {
  /** Salario diario (nominal). */
  dailyWage: number;
  /** Fecha de ingreso (ISO). */
  startDate: string;
  /** Fecha de terminación (ISO). */
  endDate: string;
  /** Días de aguinaldo que otorga el patrón (mínimo 15, artículo 87). */
  aguinaldoDays?: number;
  /** Salario pendiente de pago (días trabajados no pagados). */
  unpaidDays?: number;
  /** Días de vacaciones ya disfrutados del periodo en curso. */
  vacationDaysTaken?: number;
  /** Zona libre de la frontera norte (salario mínimo distinto). */
  borderZone?: boolean;
  /** Tipo de terminación. */
  kind: 'renuncia' | 'despido-injustificado' | 'despido-justificado' | 'rescision-trabajador';
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

function yearsBetween(a: Date, b: Date): number {
  let years = b.getFullYear() - a.getFullYear();
  const anniv = new Date(a);
  anniv.setFullYear(a.getFullYear() + years);
  if (anniv > b) years -= 1;
  return Math.max(0, years);
}

export function computeSeverance(input: SeveranceInput): CalculatorResult {
  const warnings: string[] = [];
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { lines: [], total: 0, currency: 'MXN', warnings: ['Fechas inválidas: la terminación debe ser posterior al ingreso.'] };
  }
  const wage = Math.max(0, input.dailyWage);
  const minWage = input.borderZone ? MX_PARAMETERS.salarioMinimoFrontera.value : MX_PARAMETERS.salarioMinimoGeneral.value;
  if (wage < minWage) warnings.push(`El salario diario indicado es menor al mínimo vigente (${minWage.toFixed(2)} MXN, ${MX_PARAMETERS.salarioMinimoGeneral.asOf}).`);

  const totalDays = daysBetween(start, end) + 1;
  const years = yearsBetween(start, end);
  const lines: CalculatorLine[] = [];

  // Finiquito (siempre): salarios devengados, aguinaldo y vacaciones proporcionales, prima vacacional.
  if (input.unpaidDays && input.unpaidDays > 0) {
    lines.push({ label: 'Salarios devengados no pagados', amount: round2(wage * input.unpaidDays), basis: 'Artículos 82 y 88 de la Ley Federal del Trabajo' });
  }
  const yearStart = new Date(end.getFullYear(), 0, 1);
  const daysThisYear = daysBetween(start > yearStart ? start : yearStart, end) + 1;
  const aguinaldoDays = Math.max(15, input.aguinaldoDays ?? 15);
  lines.push({
    label: `Aguinaldo proporcional (${daysThisYear} de 365 días, ${aguinaldoDays} días)`,
    amount: round2((wage * aguinaldoDays * daysThisYear) / 365),
    basis: 'Artículo 87 de la Ley Federal del Trabajo',
  });
  const anniversary = new Date(start);
  anniversary.setFullYear(start.getFullYear() + years);
  const daysSinceAnniversary = daysBetween(anniversary, end) + 1;
  const entitledDays = vacationDays(years + 1);
  const proportionalVacation = Math.max(0, (entitledDays * daysSinceAnniversary) / 365 - (input.vacationDaysTaken ?? 0));
  lines.push({
    label: `Vacaciones proporcionales (${round2(proportionalVacation)} días)`,
    amount: round2(wage * proportionalVacation),
    basis: 'Artículos 76 y 79 de la Ley Federal del Trabajo',
    note: years === 0 ? 'Primer año: 12 días de vacaciones por año completo (reforma DOF 27-12-2022).' : undefined,
  });
  lines.push({ label: 'Prima vacacional (25 %)', amount: round2(wage * proportionalVacation * 0.25), basis: 'Artículo 80 de la Ley Federal del Trabajo' });

  // Prima de antigüedad: 12 días por año, salario topado a dos veces el mínimo (artículos 162 y 486).
  const seniorityWage = Math.min(wage, 2 * minWage);
  const seniorityApplies = input.kind === 'despido-injustificado' || input.kind === 'rescision-trabajador' || input.kind === 'despido-justificado' || (input.kind === 'renuncia' && years >= 15);
  if (seniorityApplies) {
    const seniorityDays = 12 * (totalDays / 365);
    lines.push({
      label: `Prima de antigüedad (12 días por año, ${round2(totalDays / 365)} años)`,
      amount: round2(seniorityWage * seniorityDays),
      basis: 'Artículos 162 y 486 de la Ley Federal del Trabajo',
      note: seniorityWage < wage ? `Salario topado a dos salarios mínimos (${(2 * minWage).toFixed(2)} MXN).` : undefined,
    });
  } else if (input.kind === 'renuncia') {
    warnings.push('En renuncia voluntaria la prima de antigüedad solo procede con 15 años o más de servicio (artículo 162, fracción III).');
  }

  // Liquidación por despido injustificado o rescisión imputable al patrón.
  if (input.kind === 'despido-injustificado' || input.kind === 'rescision-trabajador') {
    lines.push({ label: 'Indemnización constitucional (3 meses)', amount: round2(wage * 90), basis: 'Artículo 123, apartado A, fracción XXII constitucional y artículo 48 de la Ley Federal del Trabajo' });
    lines.push({ label: `Veinte días por año de servicio (${round2(totalDays / 365)} años)`, amount: round2(wage * 20 * (totalDays / 365)), basis: 'Artículo 50, fracción II, de la Ley Federal del Trabajo', note: 'Procede cuando el patrón no reinstala o el trabajador opta por la indemnización (artículos 49 y 50).' });
    warnings.push('Los salarios vencidos (hasta 12 meses más intereses) se suman si hay juicio y sentencia favorable (artículo 48).');
  }

  warnings.push('Cálculo con salario diario nominal. Para indemnizaciones la LFT usa el salario integrado (artículo 89); prestaciones superiores al mínimo legal se respetan.');
  return { lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)), currency: 'MXN', warnings };
}

export const mxSeveranceCalculator: Calculator = {
  id: 'mx-finiquito-liquidacion',
  name: 'Finiquito y liquidación (LFT)',
  description: 'Aguinaldo y vacaciones proporcionales, prima vacacional, prima de antigüedad e indemnización por despido injustificado.',
  fields: [
    { name: 'dailyWage', label: 'Salario diario (MXN)', type: 'number', min: 0, step: 0.01, required: true },
    { name: 'startDate', label: 'Fecha de ingreso', type: 'date', required: true },
    { name: 'endDate', label: 'Fecha de terminación', type: 'date', required: true },
    { name: 'kind', label: 'Tipo de terminación', type: 'select', required: true, options: [
      { value: 'renuncia', label: 'Renuncia voluntaria' },
      { value: 'despido-injustificado', label: 'Despido injustificado' },
      { value: 'despido-justificado', label: 'Despido justificado (artículo 47)' },
      { value: 'rescision-trabajador', label: 'Rescisión por causa imputable al patrón (artículo 51)' },
    ] },
    { name: 'aguinaldoDays', label: 'Días de aguinaldo', type: 'number', min: 15, step: 1, help: 'Mínimo legal 15 días' },
    { name: 'unpaidDays', label: 'Días de salario pendientes', type: 'number', min: 0, step: 1 },
    { name: 'vacationDaysTaken', label: 'Vacaciones ya disfrutadas este periodo', type: 'number', min: 0, step: 1 },
    { name: 'borderZone', label: 'Zona libre de la frontera norte', type: 'boolean' },
  ],
  parameters: MX_PARAMETERS,
  compute: (input) => computeSeverance(input as unknown as SeveranceInput),
};

import { mxFiscalCalculators } from './calculators-fiscal';

export const mxCalculators: Calculator[] = [mxSeveranceCalculator, ...mxFiscalCalculators];
