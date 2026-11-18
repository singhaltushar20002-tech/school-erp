import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Fee collection and reports (backend/src/modules/fees): payments and
// their receipts, receipt PDFs (a `pdf` queue job), the collection and
// head-wise reports, and the defaulter list.

export type PaymentChannel =
  "cash" | "upi" | "cheque" | "card" | "bank_transfer" | "bank_slip"

/** Modes offered at the counter, most used first. */
export const COUNTER_CHANNELS: PaymentChannel[] = [
  "cash",
  "upi",
  "cheque",
  "card",
  "bank_transfer",
]

export type ReceiptStatus = "valid" | "cancelled"

export interface ReceiptAllocation {
  id: string
  amount: number
  studentName: string
  admissionNumber: string
  description: string
  period: string
}

export interface Receipt {
  id: string
  number: string
  issuedAt: string
  status: ReceiptStatus
  cancelReason: string | null
  payment: {
    id: string
    amount: number
    channel: PaymentChannel
    reference: string | null
    student?: { id: string; fullName: string } | null
  }
  allocations: ReceiptAllocation[]
}

export interface PaymentRow {
  id: string
  amount: number
  channel: PaymentChannel
  reference: string | null
  receivedAt: string
  receivedOn: string
  status: "completed" | "reversed"
  student: { id: string; fullName: string; admissionNumber: string } | null
  receipt: { id: string; number: string; status: ReceiptStatus } | null
}

export interface HeadWise {
  from: string
  to: string
  heads: { head: string; kind: string; amount: number }[]
  total: number
}

export interface DailyCollection {
  date: string
  collectors: {
    receivedBy: string
    count: number
    total: number
    byChannel: Partial<Record<PaymentChannel, number>>
    cancelled: number
  }[]
}

export interface Defaulter {
  studentId: string
  admissionNumber: string
  name: string
  rollNo: string | null
  classId: string
  className: string
  sectionId: string
  sectionName: string
  outstanding: number
  overdue: number
  oldestDueDate: string
  buckets: Record<"current" | "0-30" | "31-60" | "61-90" | "90+", number>
}

export interface DefaulterReport {
  asOf: string
  students: Defaulter[]
}

interface Job {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  error: string | null
  downloadUrl?: string | null
}

export const feeKeys = {
  all: ["fees"] as const,
  payments: (date: string, page: number) =>
    ["fees", "payments", date, page] as const,
  headWise: (date: string) => ["fees", "head-wise", date] as const,
  daily: (date: string) => ["fees", "daily", date] as const,
  defaulters: (classId: string) => ["fees", "defaulters", classId] as const,
}

export const PAYMENTS_PAGE_SIZE = 50

export const paymentsQuery = (date: string, page: number) =>
  queryOptions({
    queryKey: feeKeys.payments(date, page),
    queryFn: ({ signal }) =>
      apiFetchPage<PaymentRow>("/payments", {
        signal,
        query: { from: date, to: date, page, limit: PAYMENTS_PAGE_SIZE },
      }),
  })

export const headWiseQuery = (date: string) =>
  queryOptions({
    queryKey: feeKeys.headWise(date),
    queryFn: ({ signal }) =>
      apiFetch<HeadWise>("/fees/reports/head-wise", {
        signal,
        query: { from: date, to: date },
      }),
  })

export const dailyCollectionQuery = (date: string) =>
  queryOptions({
    queryKey: feeKeys.daily(date),
    queryFn: ({ signal }) =>
      apiFetch<DailyCollection>("/fees/reports/daily-collection", {
        signal,
        query: { date },
      }),
  })

export const defaultersQuery = (classId: string) =>
  queryOptions({
    queryKey: feeKeys.defaulters(classId),
    queryFn: ({ signal }) =>
      apiFetch<DefaulterReport>("/fees/reports/defaulters", {
        signal,
        query: { minDays: 1, classId: classId || undefined },
      }),
  })

export interface NewPayment {
  studentId: string
  channel: PaymentChannel
  /** Paise. */
  amount: number
  reference?: string
}

/**
 * Records a payment against the student's oldest dues and issues the
 * receipt. The key makes a double tap one payment, not two.
 */
export const collectPayment = (body: NewPayment, idempotencyKey: string) =>
  apiFetch<Receipt>("/payments", {
    method: "POST",
    body,
    headers: { "idempotency-key": idempotencyKey },
  })

export const cancelReceipt = (receiptId: string, reason: string) =>
  apiFetch<Receipt>(`/receipts/${receiptId}/cancel`, {
    method: "POST",
    body: { reason },
  })

/** Renders the receipt PDF (a job) and resolves with its download link. */
export async function receiptPdfUrl(
  receiptId: string,
  paper: "A4" | "80mm" = "A4"
): Promise<string> {
  let job = await apiFetch<Job>(`/receipts/${receiptId}/pdf`, {
    method: "POST",
    body: { paper },
  })
  for (let i = 0; i < 60 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "PDF failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (job.status !== "succeeded" || !job.downloadUrl) {
    throw new Error("PDF not ready")
  }
  return job.downloadUrl
}

/** Days from `dueDate` to `asOf` (both `YYYY-MM-DD`). */
export const daysOverdue = (dueDate: string, asOf: string) =>
  Math.round((Date.parse(asOf) - Date.parse(dueDate)) / 86_400_000)

export type AgeGroup = "0-30" | "31-60" | "60+"

/** The group a defaulter falls in, by their oldest unpaid due date. */
export const ageGroup = (d: Defaulter, asOf: string): AgeGroup => {
  const days = daysOverdue(d.oldestDueDate, asOf)
  return days <= 30 ? "0-30" : days <= 60 ? "31-60" : "60+"
}
