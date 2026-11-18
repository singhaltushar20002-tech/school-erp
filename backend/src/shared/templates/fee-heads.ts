/**
 * Default fee heads per country (PRD 6.2 step 6), added by
 * `POST /onboarding/templates/fee-heads/apply` for the school's
 * `locale.country`.
 */
export interface FeeHeadTemplate {
  name: string;
  /** How often it is usually billed. */
  frequency: 'once' | 'monthly' | 'yearly' | 'per_exam';
}

/** Bangladesh. */
export const BD_FEE_HEADS: FeeHeadTemplate[] = [
  { name: 'Admission Fee', frequency: 'once' },
  { name: 'Session Fee', frequency: 'yearly' },
  { name: 'Tuition Fee', frequency: 'monthly' },
  { name: 'Exam Fee', frequency: 'per_exam' },
  { name: 'Lab Fee', frequency: 'yearly' },
  { name: 'Library Fee', frequency: 'yearly' },
  { name: 'Sports Fee', frequency: 'yearly' },
  { name: 'ID Card Fee', frequency: 'once' },
  { name: 'Development Fee', frequency: 'yearly' },
  { name: 'Transport Fee', frequency: 'monthly' },
];

/** India: the heads a CBSE/ICSE/state-board school usually bills. */
export const IN_FEE_HEADS: FeeHeadTemplate[] = [
  { name: 'Admission Fee', frequency: 'once' },
  { name: 'Annual Charges', frequency: 'yearly' },
  { name: 'Tuition Fee', frequency: 'monthly' },
  { name: 'Development Fee', frequency: 'yearly' },
  { name: 'Exam Fee', frequency: 'per_exam' },
  { name: 'Computer Fee', frequency: 'monthly' },
  { name: 'Smart Class Fee', frequency: 'monthly' },
  { name: 'Activity Fee', frequency: 'yearly' },
  { name: 'Lab Fee', frequency: 'yearly' },
  { name: 'Library Fee', frequency: 'yearly' },
  { name: 'Transport Fee', frequency: 'monthly' },
];

export const FEE_HEAD_TEMPLATES: Record<'IN' | 'BD', FeeHeadTemplate[]> = {
  IN: IN_FEE_HEADS,
  BD: BD_FEE_HEADS,
};
