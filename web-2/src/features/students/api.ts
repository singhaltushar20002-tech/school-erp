import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Students (backend/src/modules/students, student-overview) and a
// student's fee statement (fees `GET /invoices/statement/:studentId`).

export type StudentStatus =
  "active" | "suspended" | "transferred" | "left" | "graduated" | "dropped_out"

/** Where a student sits this session (list rows, `placement`). */
export interface StudentPlacement {
  classId: string
  className: string
  classLevel: number | null
  sectionId: string
  sectionName: string
  rollNo: string | null
}

export interface Student {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string | null
  fullName: string
  gender: "male" | "female" | "other" | null
  /** `YYYY-MM-DD`. */
  dob: string | null
  religion: string | null
  bloodGroup: string | null
  phone: string | null
  email: string | null
  admissionDate: string | null
  previousSchool: string | null
  status: StudentStatus
  photoUrl?: string | null
}

export interface StudentRow extends Student {
  placement: StudentPlacement | null
}

export interface StudentGuardianLink {
  id: string
  relation: string
  isPrimary: boolean
  isEmergency: boolean
  guardian: {
    id: string
    name: string
    phone: string | null
    email: string | null
    occupation: string | null
    userId: string | null
  }
}

export interface AttendanceSummary {
  from: string
  to: string
  days: number
  present: number
  absent: number
  late: number
  leave: number
  halfDay: number
  percentage: number | null
}

export interface ResultSummary {
  id: string
  name: string
  gpa: number | null
  grade: string | null
  passed: boolean | null
  positionClass: number | null
  positionSection: number | null
  publishedAt: string | null
}

export interface StudentOverview {
  profile: Student
  currentEnrollment: {
    id: string
    rollNo: string | null
    academicYear: { id: string; name: string }
    schoolClass: { id: string; name: string }
    section: { id: string; name: string }
  } | null
  guardians: StudentGuardianLink[]
  attendance: AttendanceSummary | null
  results: ResultSummary[] | null
  documents: { count: number } | null
}

export interface InvoiceLine {
  id: string
  kind: "fee" | "fine" | "adhoc"
  description: string
  period: string
  amount: number
  discount: number
  net: number
  outstanding: number
}

export type InvoiceStatus = "open" | "partially_paid" | "paid" | "cancelled"

export interface Invoice {
  id: string
  number: string
  period: string
  dueDate: string
  status: InvoiceStatus
  netTotal: number
  fineTotal: number
  discountTotal: number
  lines: InvoiceLine[]
}

export interface FeeStatement {
  studentId: string
  billed: number
  discounts: number
  adjusted: number
  collected: number
  outstanding: number
  invoices: Invoice[]
}

export interface StudentFilter {
  q?: string
  classId?: string
  sectionId?: string
  page?: number
}

export const STUDENTS_PAGE_SIZE = 25

export const studentKeys = {
  list: (filter: StudentFilter) => ["students", "list", filter] as const,
  overview: (id: string) => ["students", id, "overview"] as const,
  statement: (id: string) => ["students", id, "fee-statement"] as const,
}

export const studentsQuery = (filter: StudentFilter) =>
  queryOptions({
    queryKey: studentKeys.list(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<StudentRow>("/students", {
        signal,
        query: {
          q: filter.q || undefined,
          classId: filter.classId || undefined,
          sectionId: filter.sectionId || undefined,
          page: filter.page ?? 1,
          limit: STUDENTS_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const studentOverviewQuery = (id: string) =>
  queryOptions({
    queryKey: studentKeys.overview(id),
    queryFn: ({ signal }) =>
      apiFetch<StudentOverview>(`/students/${id}/overview`, { signal }),
  })

export const feeStatementQuery = (id: string) =>
  queryOptions({
    queryKey: studentKeys.statement(id),
    queryFn: ({ signal }) =>
      apiFetch<FeeStatement>(`/invoices/statement/${id}`, { signal }),
  })

/** "Class 5 A", or null for a student with no class this session. */
export const placementLabel = (p: StudentPlacement | null | undefined) =>
  p ? `${p.className} ${p.sectionName}` : null
