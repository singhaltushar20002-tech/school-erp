/**
 * The month's pay for one employee (all amounts in minor units, rounded
 * to whole rupees). Pure, so the rules are pinned by tests:
 *
 * - Earnings are pro-rated for loss-of-pay days over the calendar month.
 * - EPF (employee share): 12% of earned basic + DA, on wages capped at
 *   ₹15,000 (so at most ₹1,800).
 * - ESI (employee share): 0.75% of earned gross, only when the full
 *   monthly gross is ₹21,000 or less.
 * - TDS: the monthly amount set on the structure.
 */
export interface SalaryInput {
  basic: number;
  hra: number;
  da: number;
  otherAllowances: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  tdsMonthly: number;
}

export interface PayLine {
  key: string;
  label: string;
  amount: number;
}

export interface PayResult {
  gross: number;
  earnings: PayLine[];
  deductions: PayLine[];
  totalDeductions: number;
  net: number;
}

export const PF_WAGE_CAP = 15_000_00;
export const ESI_GROSS_LIMIT = 21_000_00;

const rupee = (minor: number) => Math.round(minor / 100) * 100;

export function computePay(
  s: SalaryInput,
  daysInMonth: number,
  lopDays: number,
): PayResult {
  const paid = Math.max(0, daysInMonth - Math.min(lopDays, daysInMonth));
  const factor = daysInMonth ? paid / daysInMonth : 0;
  const earn = (amount: number) => rupee(amount * factor);
  const earnings: PayLine[] = [
    { key: 'basic', label: 'Basic', amount: earn(s.basic) },
    { key: 'hra', label: 'HRA', amount: earn(s.hra) },
    { key: 'da', label: 'DA', amount: earn(s.da) },
    {
      key: 'other',
      label: 'Other allowances',
      amount: earn(s.otherAllowances),
    },
  ].filter((l) => l.amount > 0);
  const gross = earnings.reduce((n, l) => n + l.amount, 0);
  const fullGross = s.basic + s.hra + s.da + s.otherAllowances;
  const basicDa =
    (earnings.find((l) => l.key === 'basic')?.amount ?? 0) +
    (earnings.find((l) => l.key === 'da')?.amount ?? 0);
  const deductions: PayLine[] = [];
  if (s.pfApplicable) {
    deductions.push({
      key: 'epf',
      label: 'EPF (12%)',
      amount: rupee(Math.min(basicDa, PF_WAGE_CAP) * 0.12),
    });
  }
  if (s.esiApplicable && fullGross <= ESI_GROSS_LIMIT) {
    deductions.push({
      key: 'esi',
      label: 'ESI (0.75%)',
      amount: Math.ceil((gross * 0.0075) / 100) * 100,
    });
  }
  if (s.tdsMonthly > 0) {
    deductions.push({ key: 'tds', label: 'TDS', amount: s.tdsMonthly });
  }
  const totalDeductions = deductions.reduce((n, l) => n + l.amount, 0);
  return {
    gross,
    earnings,
    deductions: deductions.filter((d) => d.amount > 0),
    totalDeductions,
    net: gross - totalDeductions,
  };
}
