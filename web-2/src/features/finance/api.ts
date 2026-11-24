import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Invoices, expenses and the cash/bank book (backend/src/modules/fees).
// Money is in minor units (paise) throughout.

export const INVOICE_STATUSES = [
  "open",
  "partially_paid",
  "paid",
  "cancelled",
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export interface InvoiceLine {
  id: string
  description: string
  period: string | null
  kind: string
  amount: number
  discount: number
  net: number
  adjusted: number
  allocated: number
  refunded: number
  cancelled: boolean
  outstanding: number
}

export interface InvoiceRow {
  id: string
  number: string
  kind: string
  studentId: string
  student: { id: string; fullName: string; admissionNumber: string }
  enrollment: {
    schoolClass: { name: string } | null
    section: { name: string } | null
  } | null
  period: string | null
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  netTotal: number
  allocatedTotal: number
  outstanding: number
  note: string | null
  cancelReason: string | null
  lines?: InvoiceLine[]
}

export interface InvoiceFilter {
  classId: string
  period: string
  status: InvoiceStatus | ""
  page: number
}

export const INVOICES_PAGE_SIZE = 25

export const financeKeys = {
  all: ["finance"] as const,
  invoices: (filter: InvoiceFilter) => ["finance", "invoices", filter] as const,
  invoice: (id: string) => ["finance", "invoice", id] as const,
  expenses: (filter: ExpenseFilter) => ["finance", "expenses", filter] as const,
  categories: ["finance", "expense-categories"] as const,
  book: (account: Account, from: string, to: string) =>
    ["finance", "book", { account, from, to }] as const,
}

export const invoicesQuery = (filter: InvoiceFilter) =>
  queryOptions({
    queryKey: financeKeys.invoices(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<InvoiceRow>("/invoices", {
        signal,
        query: {
          classId: filter.classId || undefined,
          period: filter.period || undefined,
          status: filter.status || undefined,
          page: filter.page,
          limit: INVOICES_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: financeKeys.invoice(id),
    queryFn: ({ signal }) =>
      apiFetch<InvoiceRow>(`/invoices/${id}`, { signal }),
  })

/** Reverses unpaid lines; refused once money has been allocated. */
export const cancelInvoice = (id: string, reason: string) =>
  apiFetch<InvoiceRow>(`/invoices/${id}/cancel`, {
    method: "POST",
    body: { reason },
  })

/** Bills every student for a month now (normally the scheduler does it). */
export const generateInvoices = (period: string) =>
  apiFetch<unknown>("/invoices/generate", {
    method: "POST",
    body: { period },
  })

export const ACCOUNTS = ["cash", "bank"] as const
export type Account = (typeof ACCOUNTS)[number]

export interface ExpenseCategory {
  id: string
  name: string
}

export interface Expense {
  id: string
  voucherNo: string
  categoryId: string
  category: { id: string; name: string } | null
  amount: number
  paidFrom: Account
  date: string
  note: string | null
  voidedAt: string | null
  voidReason: string | null
}

export interface ExpenseFilter {
  categoryId: string
  from: string
  to: string
  page: number
}

export const EXPENSES_PAGE_SIZE = 50

export const expensesQuery = (filter: ExpenseFilter) =>
  queryOptions({
    queryKey: financeKeys.expenses(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<Expense>("/expenses", {
        signal,
        query: {
          categoryId: filter.categoryId || undefined,
          from: filter.from || undefined,
          to: filter.to || undefined,
          page: filter.page,
          limit: EXPENSES_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const categoriesQuery = () =>
  queryOptions({
    queryKey: financeKeys.categories,
    queryFn: async ({ signal }) =>
      (
        await apiFetch<ExpenseCategory[]>("/expenses/categories", { signal })
      ).sort((a, b) => a.name.localeCompare(b.name)),
  })

export const createCategory = (name: string) =>
  apiFetch<ExpenseCategory>("/expenses/categories", {
    method: "POST",
    body: { name },
  })

export const createExpense = (body: {
  categoryId: string
  amount: number
  paidFrom: Account
  date?: string
  note?: string
}) => apiFetch<Expense>("/expenses", { method: "POST", body })

/** Writes a reversing book entry; the expense stays, marked void. */
export const voidExpense = (id: string, reason: string) =>
  apiFetch<Expense>(`/expenses/${id}/void`, {
    method: "POST",
    body: { reason },
  })

export interface BookEntry {
  id: string
  date: string
  description: string
  sourceType: string
  sourceId: string
  income: number
  expense: number
  balance: number
}

export interface Book {
  account: Account
  from: string
  to: string
  opening: number
  income: number
  expense: number
  closing: number
  entries: BookEntry[]
}

export const bookQuery = (account: Account, from: string, to: string) =>
  queryOptions({
    queryKey: financeKeys.book(account, from, to),
    queryFn: ({ signal }) =>
      apiFetch<Book>("/ledger/book", {
        signal,
        query: { account, from, to },
      }),
    enabled: Boolean(from && to && from <= to),
  })
