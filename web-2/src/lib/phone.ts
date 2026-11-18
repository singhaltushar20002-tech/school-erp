/**
 * A phone number the backend accepts (`normalizePhone` in
 * `backend/src/common/identity/identifier.ts`): an Indian mobile in local
 * or `+91` form, a Bangladeshi mobile in local or `+880` form, or any E.164
 * number. Returns the E.164 form, or null.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s\-().]/g, "")
  const india = /^(?:(?:\+|00)?91)?0?([6-9]\d{9})$/.exec(compact)
  if (india) return `+91${india[1]}`
  if (compact.startsWith("+91")) return null
  const bd = /^(?:\+?880)?0?(1[3-9]\d{8})$/.exec(compact)
  if (bd) return `+880${bd[1]}`
  if (compact.startsWith("+880")) return null
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}

/**
 * A stored E.164 number as people write it: `+919876500001` →
 * `+91 98765 00001`, `+8801712345678` → `+880 1712-345678`. Others as is.
 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return ""
  const india = /^\+91([6-9]\d{4})(\d{5})$/.exec(e164)
  if (india) return `+91 ${india[1]} ${india[2]}`
  const bd = /^\+880(1\d{3})(\d{6})$/.exec(e164)
  if (bd) return `+880 ${bd[1]}-${bd[2]}`
  return e164
}
