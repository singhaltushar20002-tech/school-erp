import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export interface Book {
  id: string
  title: string
  author: string | null
  isbn: string | null
  category: string | null
  publisher: string | null
  total: number
  available: number
  accessions: string[]
}

export interface Loan {
  id: string
  accessionNo: string
  title: string
  author: string | null
  studentId: string
  studentName: string
  admissionNumber: string
  className: string | null
  sectionName: string | null
  issuedOn: string
  dueOn: string
  returnedOn: string | null
  daysOverdue: number
  fine: number
}

export type LoanFilter = "out" | "overdue" | "returned"

export const libraryKeys = {
  all: ["library"] as const,
  books: (q: string) => ["library", "books", q] as const,
  loans: (status: LoanFilter) => ["library", "loans", status] as const,
}

export const booksQuery = (q: string) =>
  queryOptions({
    queryKey: libraryKeys.books(q),
    queryFn: ({ signal }) =>
      apiFetch<Book[]>("/library/books", { signal, query: q ? { q } : {} }),
  })

export const loansQuery = (status: LoanFilter) =>
  queryOptions({
    queryKey: libraryKeys.loans(status),
    queryFn: ({ signal }) =>
      apiFetch<Loan[]>("/library/issues", { signal, query: { status } }),
  })

export const addBook = (body: {
  title: string
  author?: string | null
  isbn?: string | null
  category?: string | null
  copies?: number
}) => apiFetch<Book>("/library/books", { method: "POST", body })

export const addCopies = (id: string, count: number) =>
  apiFetch<Book>(`/library/books/${id}/copies`, {
    method: "POST",
    body: { count },
  })

export const issueBook = (accessionNo: string, studentId: string) =>
  apiFetch<Loan>("/library/issues", {
    method: "POST",
    body: { accessionNo, studentId },
  })

export const returnBook = (id: string) =>
  apiFetch<{ daysLate: number; fine: number; billed: boolean }>(
    `/library/issues/${id}/return`,
    { method: "POST" }
  )

/** ₹2 a day, as the backend charges. */
export const FINE_PER_DAY = 200
