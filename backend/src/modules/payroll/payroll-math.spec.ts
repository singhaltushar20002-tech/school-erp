import { computePay } from './payroll-math';

const base = {
  basic: 30_000_00,
  hra: 12_000_00,
  da: 6_000_00,
  otherAllowances: 2_000_00,
  pfApplicable: true,
  esiApplicable: true,
  tdsMonthly: 1_500_00,
};

describe('computePay', () => {
  it('pays the full month without loss of pay, EPF capped at ₹1,800', () => {
    const p = computePay(base, 30, 0);
    expect(p.gross).toBe(50_000_00);
    expect(p.deductions.find((d) => d.key === 'epf')?.amount).toBe(1_800_00);
    // Gross above ₹21,000: no ESI.
    expect(p.deductions.find((d) => d.key === 'esi')).toBeUndefined();
    expect(p.net).toBe(50_000_00 - 1_800_00 - 1_500_00);
  });

  it('pro-rates earnings for loss-of-pay days', () => {
    const p = computePay(base, 30, 3);
    expect(p.earnings.find((e) => e.key === 'basic')?.amount).toBe(27_000_00);
    expect(p.gross).toBe(45_000_00);
  });

  it('deducts ESI at 0.75% for gross up to ₹21,000', () => {
    const p = computePay(
      {
        basic: 12_000_00,
        hra: 4_000_00,
        da: 2_000_00,
        otherAllowances: 0,
        pfApplicable: true,
        esiApplicable: true,
        tdsMonthly: 0,
      },
      31,
      0,
    );
    expect(p.deductions.find((d) => d.key === 'esi')?.amount).toBe(13_500);
    expect(p.deductions.find((d) => d.key === 'epf')?.amount).toBe(1_680_00);
  });

  it('never pays for more loss-of-pay days than the month has', () => {
    expect(computePay(base, 30, 45).gross).toBe(0);
  });
});
