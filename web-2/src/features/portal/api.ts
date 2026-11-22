import { queryOptions } from "@tanstack/react-query"

import type { AttendanceTally } from "~/features/dashboard/api"
import type { FeeStatement } from "~/features/students/api"
import type { CalendarMonth } from "~/features/calendar/api"
import type { Loan } from "~/features/library/api"
import type { TimetableGrid } from "~/features/timetable/api"
import type {
  LivePosition,
  Route as TransportRoute,
} from "~/features/transport/api"
import { apiFetch } from "~/lib/api/client"

// The guardian and student portal (backend/src/modules/portal/). Every
// child route answers 404 for a student not linked to the user.

/** `PortalChild`: a child the user may see, with their current placement. */
export interface PortalChild {
  studentId: string
  name: string
  nameBn: string | null
  admissionNumber: string
  /** `self` for a student's own account. */
  relation: "guardian" | "self"
  enrollment: {
    id: string
    academicYearId: string
    classId: string
    className: string
    sectionId: string
    sectionName: string
    rollNo: string | null
  } | null
}

/** `GET /portal/schools`: the user's other schools with children there. */
export interface PortalSchool {
  orgId: string
  slug: string
  name: string
  host: string
  children: { studentId: string; name: string; className: string | null }[]
}

export type CountsAs = "present" | "absent" | "late" | "leave" | "half_day"

export interface PortalNotice {
  id: string
  title: string
  body: string
  publishAt: string
  pinned: boolean
  read: boolean
}

/** `GET /portal/children/:id/dashboard`. Money in minor units. */
export interface ChildDashboard {
  child: PortalChild
  attendance: {
    /** Today's record, or null when the register isn't taken. */
    today: {
      date: string
      status: string
      label: string
      labelBn: string
      countsAs: CountsAs
    } | null
    /** The session so far; null without an enrollment or session dates. */
    session: (AttendanceTally & { from: string; to: string }) | null
  }
  upcomingExams: {
    id: string
    name: string
    startDate: string | null
    endDate: string | null
  }[]
  dues: {
    outstanding: number
    nextDueDate: string | null
    nextDueAmount: number
  }
  notices: PortalNotice[]
}

export const portalKeys = {
  children: ["portal", "children"] as const,
  schools: ["portal", "schools"] as const,
  dashboard: (studentId: string) =>
    ["portal", "children", studentId, "dashboard"] as const,
}

export const childrenQuery = () =>
  queryOptions({
    queryKey: portalKeys.children,
    queryFn: ({ signal }) =>
      apiFetch<PortalChild[]>("/portal/children", { signal }),
    staleTime: 5 * 60_000,
  })

/** Other schools change rarely; asked for when the menu needs them. */
export const portalSchoolsQuery = () =>
  queryOptions({
    queryKey: portalKeys.schools,
    queryFn: ({ signal }) =>
      apiFetch<PortalSchool[]>("/portal/schools", { signal }),
    staleTime: 5 * 60_000,
  })

export const childDashboardQuery = (studentId: string) =>
  queryOptions({
    queryKey: portalKeys.dashboard(studentId),
    queryFn: ({ signal }) =>
      apiFetch<ChildDashboard>(
        `/portal/children/${encodeURIComponent(studentId)}/dashboard`,
        { signal }
      ),
    staleTime: 60_000,
  })

/** A one-time sign-in code for another school; open `redirectUrl`. */
export const portalHandoff = (orgId: string) =>
  apiFetch<{ redirectUrl: string }>("/portal/handoff", {
    method: "POST",
    body: { orgId },
  })

/** The child's name in the viewer's language. */
export const childName = (
  child: Pick<PortalChild, "name" | "nameBn">,
  locale: string
) => (locale === "bn" && child.nameBn) || child.name

/**
 * The child the URL asks for (`?child=`) when the user may see them, else
 * the first one.
 */
export function selectedChild(
  children: PortalChild[],
  requested: string | null | undefined
): PortalChild | null {
  return children.find((c) => c.studentId === requested) ?? children[0] ?? null
}

// --- Child pages: attendance, leave, results, fees, notices -------------

export interface AttendanceDay {
  date: string
  status: string
  label: string
  countsAs: CountsAs
}

export interface AttendanceMonth {
  from: string
  to: string
  days: AttendanceDay[]
}

export interface PortalLeave {
  id: string
  fromDate: string
  toDate: string
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  decisionNote: string | null
  createdAt: string
}

export interface PortalResultSummary {
  id: string
  name: string
  grade: string | null
  passed: boolean | null
  positionClass: number | null
  positionSection: number | null
  publishedAt: string | null
}

export interface PortalResult {
  id: string
  /** The student's name. */
  name: string
  total: number | null
  fullMarks: number | null
  percentage: number | null
  grade: string | null
  passed: boolean | null
  positionSection: number | null
  positionClass: number | null
  remarks: string | null
  subjects: {
    classSubjectId: string
    subjectName: string
    marks: number | null
    fullMarks: number
    grade: string | null
    passed: boolean | null
    absent: boolean
  }[]
}

export interface PortalPayment {
  id: string
  amount: number
  channel: string
  receivedAt: string
  receiptId: string | null
  receiptNumber: string | null
  receiptStatus: "valid" | "cancelled" | null
}

const child = (id: string) => `/portal/children/${encodeURIComponent(id)}`

export const childKeys = {
  attendance: (id: string, month: string) =>
    ["portal", "children", id, "attendance", month] as const,
  leaves: (id: string) => ["portal", "children", id, "leave"] as const,
  results: (id: string) => ["portal", "children", id, "results"] as const,
  result: (id: string, resultId: string) =>
    ["portal", "children", id, "results", resultId] as const,
  fees: (id: string) => ["portal", "children", id, "fees"] as const,
  payments: ["portal", "payments"] as const,
  notices: ["portal", "notices"] as const,
}

export const attendanceMonthQuery = (id: string, month: string) =>
  queryOptions({
    queryKey: childKeys.attendance(id, month),
    queryFn: ({ signal }) =>
      apiFetch<AttendanceMonth>(`${child(id)}/attendance`, {
        signal,
        query: { month },
      }),
  })

export const childLeavesQuery = (id: string) =>
  queryOptions({
    queryKey: childKeys.leaves(id),
    queryFn: ({ signal }) =>
      apiFetch<PortalLeave[]>(`${child(id)}/leave`, { signal }),
  })

export const applyLeave = (
  id: string,
  body: { fromDate: string; toDate?: string; reason: string }
) => apiFetch<PortalLeave>(`${child(id)}/leave`, { method: "POST", body })

export const childResultsQuery = (id: string) =>
  queryOptions({
    queryKey: childKeys.results(id),
    queryFn: ({ signal }) =>
      apiFetch<{ blocked: boolean; results: PortalResultSummary[] }>(
        `${child(id)}/results`,
        { signal }
      ),
  })

export const childResultQuery = (id: string, resultId: string) =>
  queryOptions({
    queryKey: childKeys.result(id, resultId),
    queryFn: ({ signal }) =>
      apiFetch<PortalResult>(`${child(id)}/results/${resultId}`, { signal }),
  })

/** The report card PDF's link; 404 `NO_REPORT_CARD` until it is printed. */
export const reportCardUrl = (id: string, resultId: string) =>
  apiFetch<{ url: string }>(`${child(id)}/results/${resultId}/report-card`)

export const childFeesQuery = (id: string) =>
  queryOptions({
    queryKey: childKeys.fees(id),
    queryFn: ({ signal }) =>
      apiFetch<FeeStatement>(`${child(id)}/fees`, { signal }),
  })

export const portalPaymentsQuery = () =>
  queryOptions({
    queryKey: childKeys.payments,
    queryFn: ({ signal }) =>
      apiFetch<PortalPayment[]>("/portal/payments", { signal }),
  })

export const portalNoticesQuery = () =>
  queryOptions({
    queryKey: childKeys.notices,
    queryFn: async ({ signal }) =>
      apiFetch<PortalNotice[]>("/portal/notices", {
        signal,
        query: { limit: 50 },
      }),
  })

/** A receipt PDF for the family (a job); resolves with the link. */
export async function portalReceiptUrl(receiptId: string): Promise<string> {
  type Job = { id: string; status: string; downloadUrl?: string | null }
  let job = await apiFetch<Job>(`/portal/receipts/${receiptId}/pdf`, {
    method: "POST",
    body: { paper: "A4" },
  })
  for (let i = 0; i < 60 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error("PDF failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (!job.downloadUrl) throw new Error("PDF not ready")
  return job.downloadUrl
}

export interface PortalHomework {
  id: string
  subjectName: string
  title: string
  description: string | null
  assignedOn: string
  dueDate: string
  handedIn: boolean
  attachmentLinks: { fileId: string; name: string; url: string }[]
}

export const childHomeworkQuery = (id: string) =>
  queryOptions({
    queryKey: ["portal", "children", id, "homework"] as const,
    queryFn: ({ signal }) =>
      apiFetch<PortalHomework[]>(`${child(id)}/homework`, { signal }),
  })

export const childTimetableQuery = (id: string) =>
  queryOptions({
    queryKey: ["portal", "children", id, "timetable"] as const,
    queryFn: ({ signal }) =>
      apiFetch<{ timetable: TimetableGrid | null }>(`${child(id)}/timetable`, {
        signal,
      }),
  })

export const childCalendarQuery = (id: string, month: string) =>
  queryOptions({
    queryKey: ["portal", "children", id, "calendar", month] as const,
    queryFn: ({ signal }) =>
      apiFetch<CalendarMonth>(`${child(id)}/calendar`, {
        signal,
        query: { month },
      }),
  })

export const childTransportQuery = (id: string) =>
  queryOptions({
    queryKey: ["portal", "children", id, "transport"] as const,
    queryFn: ({ signal }) =>
      apiFetch<{
        transport: {
          route: TransportRoute
          stopId: string
          live: LivePosition
        } | null
      }>(`${child(id)}/transport`, { signal }),
    refetchInterval: 30_000,
  })

export const childLibraryQuery = (id: string) =>
  queryOptions({
    queryKey: ["portal", "children", id, "library"] as const,
    queryFn: ({ signal }) =>
      apiFetch<Loan[]>(`${child(id)}/library`, { signal }),
  })
