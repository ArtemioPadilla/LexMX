/**
 * Calculadoras fiscales y de plazos para México (plan Fase 8 / § 11.4 C):
 * ISR mensual de sueldos (art. 96 LISR), IVA (arts. 1 y 2-A LIVA), recargos
 * por mora (art. 21 CFF y art. 8 LIF) y cómputo de plazos en días hábiles
 * (art. 12 CFF, art. 74 LFT). Funciones puras con parámetros fechados.
 */
import type { Calculator, CalculatorResult } from '../types';

/** Tarifa mensual art. 96 LISR (Anexo 8 RMF): límite inferior, cuota fija, % sobre excedente. */
export const ISR_MONTHLY_TABLE_2025: Array<{ lower: number; fixed: number; rate: number }> = [
  { lower: 0.01, fixed: 0, rate: 0.0192 },
  { lower: 746.05, fixed: 14.32, rate: 0.064 },
  { lower: 6332.06, fixed: 371.83, rate: 0.1088 },
  { lower: 11128.02, fixed: 893.63, rate: 0.16 },
  { lower: 12935.83, fixed: 1182.88, rate: 0.1792 },
  { lower: 15487.72, fixed: 1640.18, rate: 0.2136 },
  { lower: 31236.5, fixed: 5004.12, rate: 0.2352 },
  { lower: 49233.01, fixed: 9236.89, rate: 0.3 },
  { lower: 93993.91, fixed: 22665.17, rate: 0.32 },
  { lower: 125325.21, fixed: 32691.18, rate: 0.34 },
  { lower: 375975.62, fixed: 117912.32, rate: 0.35 },
];

export const FISCAL_PARAMETERS = {
  /** Subsidio para el empleo mensual (Decreto DOF 1/V/2024, prorrogado): monto fijo si el ingreso no excede el tope. */
  employmentSubsidy: { value: 475, asOf: '2025-01-01', source: 'Decreto de subsidio para el empleo, DOF 1/V/2024' },
  employmentSubsidyCap: { value: 10171, asOf: '2025-01-01', source: 'Decreto de subsidio para el empleo, DOF 1/V/2024' },
  vatGeneral: { value: 0.16, asOf: '2010-01-01', source: 'Artículo 1 de la Ley del Impuesto al Valor Agregado' },
  vatBorder: { value: 0.08, asOf: '2019-01-01', source: 'Decreto de estímulos fiscales región fronteriza norte, DOF 31/XII/2018' },
  monthlySurcharge: { value: 0.0147, asOf: '2025-01-01', source: 'Artículo 8 de la Ley de Ingresos de la Federación; artículo 21 del CFF' },
} as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface IsrInput {
  monthlyIncome: number;
  applySubsidy?: boolean;
}

/** ISR mensual por sueldos y salarios (art. 96 LISR) con subsidio opcional. */
export function computeMonthlyIsr(input: IsrInput): CalculatorResult {
  const income = Math.max(0, Number(input.monthlyIncome) || 0);
  const warnings: string[] = [];
  let bracket = ISR_MONTHLY_TABLE_2025[0]!;
  for (const b of ISR_MONTHLY_TABLE_2025) if (income >= b.lower) bracket = b;
  const excess = Math.max(0, income - bracket.lower + 0.01);
  const marginal = round2(excess * bracket.rate);
  const tax = round2(bracket.fixed + marginal);
  const lines = [
    { label: 'Ingreso gravable mensual', amount: round2(income), basis: 'Artículo 94 de la Ley del Impuesto sobre la Renta' },
    { label: `Cuota fija (límite inferior ${bracket.lower.toLocaleString('es-MX')})`, amount: bracket.fixed, basis: 'Artículo 96 de la Ley del Impuesto sobre la Renta' },
    { label: `Impuesto marginal (${(bracket.rate * 100).toFixed(2)} % sobre el excedente)`, amount: marginal, basis: 'Artículo 96 de la Ley del Impuesto sobre la Renta' },
  ];
  let subsidy = 0;
  if (input.applySubsidy && income <= FISCAL_PARAMETERS.employmentSubsidyCap.value) {
    subsidy = Math.min(FISCAL_PARAMETERS.employmentSubsidy.value, tax);
    lines.push({ label: 'Subsidio para el empleo', amount: -subsidy, basis: FISCAL_PARAMETERS.employmentSubsidy.source });
  }
  if (income > FISCAL_PARAMETERS.employmentSubsidyCap.value && input.applySubsidy) warnings.push('El ingreso excede el tope del subsidio para el empleo; no aplica.');
  warnings.push('Tarifa mensual vigente a la fecha indicada en los parámetros; verifica el Anexo 8 de la RMF del ejercicio.');
  return { lines, total: round2(tax - subsidy), currency: 'MXN', warnings };
}

export interface VatInput {
  amount: number;
  regime: 'general' | 'border' | 'zero' | 'exempt';
  includesVat?: boolean;
}

/** IVA trasladado sobre un importe (arts. 1, 2-A y 9 LIVA; estímulo fronterizo). */
export function computeVat(input: VatInput): CalculatorResult {
  const amount = Math.max(0, Number(input.amount) || 0);
  const rate = input.regime === 'general' ? FISCAL_PARAMETERS.vatGeneral.value : input.regime === 'border' ? FISCAL_PARAMETERS.vatBorder.value : 0;
  const base = input.includesVat && rate > 0 ? round2(amount / (1 + rate)) : amount;
  const vat = round2(base * rate);
  const basis = input.regime === 'zero' ? 'Artículo 2-A de la Ley del Impuesto al Valor Agregado' : input.regime === 'exempt' ? 'Artículo 9 de la Ley del Impuesto al Valor Agregado' : input.regime === 'border' ? FISCAL_PARAMETERS.vatBorder.source : FISCAL_PARAMETERS.vatGeneral.source;
  const warnings: string[] = [];
  if (input.regime === 'border') warnings.push('La tasa del 8 % exige inscripción en el padrón del estímulo y actividad en la franja fronteriza.');
  if (input.regime === 'exempt') warnings.push('Los actos exentos no trasladan IVA ni permiten acreditar el pagado en sus insumos.');
  return {
    lines: [
      { label: 'Base gravable', amount: base, basis: 'Artículo 12 de la Ley del Impuesto al Valor Agregado' },
      { label: `IVA (${(rate * 100).toFixed(0)} %)`, amount: vat, basis },
    ],
    total: round2(base + vat),
    currency: 'MXN',
    warnings,
  };
}

export interface SurchargeInput {
  amount: number;
  dueDate: string;
  paymentDate: string;
  /** Factor de actualización INPC (mes de pago / mes de vencimiento); 1 si no se conoce. */
  updateFactor?: number;
}

/** Meses completos o fracción entre dos fechas (art. 21 CFF: la fracción cuenta como mes). */
export function monthsOfDelay(dueDate: string, paymentDate: string): number {
  const due = new Date(dueDate);
  const paid = new Date(paymentDate);
  if (Number.isNaN(due.getTime()) || Number.isNaN(paid.getTime()) || paid <= due) return 0;
  let months = (paid.getFullYear() - due.getFullYear()) * 12 + (paid.getMonth() - due.getMonth());
  if (paid.getDate() > due.getDate()) months += 1;
  return Math.max(1, months);
}

/** Contribución omitida: actualización y recargos por mora (art. 17-A y 21 CFF). */
export function computeSurcharges(input: SurchargeInput): CalculatorResult {
  const amount = Math.max(0, Number(input.amount) || 0);
  const factor = Math.max(1, Number(input.updateFactor) || 1);
  const months = monthsOfDelay(input.dueDate, input.paymentDate);
  const updated = round2(amount * factor);
  const update = round2(updated - amount);
  const surcharges = round2(updated * FISCAL_PARAMETERS.monthlySurcharge.value * months);
  const warnings = ['Los recargos se causan hasta por cinco años (art. 21 CFF); la actualización usa el INPC del mes anterior al más reciente del periodo.'];
  if (factor === 1) warnings.push('Sin factor de actualización: el resultado omite la actualización por inflación (art. 17-A CFF).');
  return {
    lines: [
      { label: 'Contribución omitida', amount, basis: 'Artículo 21 del Código Fiscal de la Federación' },
      { label: `Actualización (factor ${factor.toFixed(4)})`, amount: update, basis: 'Artículo 17-A del Código Fiscal de la Federación' },
      { label: `Recargos (${months} mes(es) × ${(FISCAL_PARAMETERS.monthlySurcharge.value * 100).toFixed(2)} %)`, amount: surcharges, basis: FISCAL_PARAMETERS.monthlySurcharge.source },
    ],
    total: round2(updated + surcharges),
    currency: 'MXN',
    warnings,
  };
}

/** Días de descanso obligatorio (art. 74 LFT) como MM-DD; los variables se calculan por año. */
export function mxHolidays(year: number): string[] {
  const nthMonday = (month: number, n: number): string => {
    const d = new Date(Date.UTC(year, month - 1, 1));
    const offset = (8 - d.getUTCDay()) % 7;
    const day = 1 + offset + (n - 1) * 7;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const days = [`${year}-01-01`, nthMonday(2, 1), nthMonday(3, 3), `${year}-05-01`, `${year}-09-16`, nthMonday(11, 3), `${year}-12-25`];
  if ((year - 2024) % 6 === 0) days.push(`${year}-10-01`); // transmisión del Poder Ejecutivo Federal
  return days;
}

export interface DeadlineInput {
  startDate: string;
  days: number;
  kind: 'business' | 'calendar';
}

/** Fecha límite contando días hábiles (sin sábados, domingos ni art. 74 LFT) o naturales, a partir del día siguiente a la notificación. */
export function computeDeadline(input: DeadlineInput): { deadline: string; skipped: string[] } {
  const start = new Date(`${input.startDate}T12:00:00Z`);
  const total = Math.max(0, Math.floor(Number(input.days) || 0));
  const skipped: string[] = [];
  const cursor = new Date(start);
  let counted = 0;
  while (counted < total) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const iso = cursor.toISOString().slice(0, 10);
    if (input.kind === 'business') {
      const dow = cursor.getUTCDay();
      if (dow === 0 || dow === 6 || mxHolidays(cursor.getUTCFullYear()).includes(iso)) {
        skipped.push(iso);
        continue;
      }
    }
    counted++;
  }
  return { deadline: cursor.toISOString().slice(0, 10), skipped };
}

export const mxIsrCalculator: Calculator = {
  id: 'mx-isr-mensual',
  name: 'ISR mensual de sueldos (LISR)',
  description: 'Retención mensual conforme a la tarifa del artículo 96 LISR, con subsidio para el empleo opcional.',
  fields: [
    { name: 'monthlyIncome', label: 'Ingreso gravable mensual (MXN)', type: 'number', min: 0, step: 0.01, required: true },
    { name: 'applySubsidy', label: 'Aplicar subsidio para el empleo', type: 'boolean' },
  ],
  parameters: { employmentSubsidy: FISCAL_PARAMETERS.employmentSubsidy, employmentSubsidyCap: FISCAL_PARAMETERS.employmentSubsidyCap },
  compute: (input) => computeMonthlyIsr(input as unknown as IsrInput),
};

export const mxVatCalculator: Calculator = {
  id: 'mx-iva',
  name: 'IVA (LIVA)',
  description: 'IVA trasladado a tasa general, fronteriza, 0 % o exento; acepta importes con IVA incluido.',
  fields: [
    { name: 'amount', label: 'Importe (MXN)', type: 'number', min: 0, step: 0.01, required: true },
    { name: 'regime', label: 'Tasa', type: 'select', options: [{ value: 'general', label: 'General 16 %' }, { value: 'border', label: 'Región fronteriza 8 %' }, { value: 'zero', label: 'Tasa 0 %' }, { value: 'exempt', label: 'Exento' }] },
    { name: 'includesVat', label: 'El importe ya incluye IVA', type: 'boolean' },
  ],
  parameters: { vatGeneral: FISCAL_PARAMETERS.vatGeneral, vatBorder: FISCAL_PARAMETERS.vatBorder },
  compute: (input) => computeVat(input as unknown as VatInput),
};

export const mxSurchargeCalculator: Calculator = {
  id: 'mx-recargos',
  name: 'Actualización y recargos (CFF)',
  description: 'Contribución omitida actualizada y recargos por mora a la tasa mensual de la Ley de Ingresos.',
  fields: [
    { name: 'amount', label: 'Contribución omitida (MXN)', type: 'number', min: 0, step: 0.01, required: true },
    { name: 'dueDate', label: 'Fecha en que debió pagarse', type: 'date', required: true },
    { name: 'paymentDate', label: 'Fecha de pago', type: 'date', required: true },
    { name: 'updateFactor', label: 'Factor de actualización INPC', type: 'number', min: 1, step: 0.0001, help: 'INPC del mes anterior al de pago entre INPC del mes anterior al de vencimiento; 1 si no lo conoces.' },
  ],
  parameters: { monthlySurcharge: FISCAL_PARAMETERS.monthlySurcharge },
  compute: (input) => computeSurcharges(input as unknown as SurchargeInput),
};

export const mxDeadlineCalculator: Calculator = {
  id: 'mx-plazos',
  name: 'Plazos en días hábiles',
  description: 'Fecha límite a partir del día siguiente a la notificación, sin sábados, domingos ni días de descanso obligatorio.',
  fields: [
    { name: 'startDate', label: 'Fecha de notificación', type: 'date', required: true },
    { name: 'days', label: 'Días del plazo', type: 'number', min: 1, step: 1, required: true },
    { name: 'kind', label: 'Tipo de días', type: 'select', options: [{ value: 'business', label: 'Hábiles' }, { value: 'calendar', label: 'Naturales' }] },
  ],
  parameters: {},
  compute: (input) => {
    const r = computeDeadline(input as unknown as DeadlineInput);
    return {
      lines: [
        { label: 'Fecha límite', amount: 0, text: r.deadline, basis: 'Artículo 12 del Código Fiscal de la Federación; artículo 74 de la Ley Federal del Trabajo' },
        { label: 'Días inhábiles omitidos', amount: r.skipped.length, basis: 'Artículo 74 de la Ley Federal del Trabajo' },
      ],
      total: 0,
      currency: 'MXN',
      warnings: ['Cada ordenamiento fija sus propios días inhábiles (p. ej. periodos vacacionales del tribunal); confirma en el acuerdo aplicable.'],
    };
  },
};

export const mxFiscalCalculators: Calculator[] = [mxIsrCalculator, mxVatCalculator, mxSurchargeCalculator, mxDeadlineCalculator];
