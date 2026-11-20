import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

// Attendance registers (backend/src/modules/attendance): which sections
// are in for a day, a section's roster for a day, and saving it.

export type SubmissionState = "submitted" | "pending" | "holiday"

export interface SectionDayStatus {
  sectionId: string
  sectionName: string
  classId: string
  className: string
  status: SubmissionState
  holiday: string | null
  submittedAt: string | null
}

export interface SubmissionStatus {
  date: string
  weekend: boolean
  rows: SectionDayStatus[]
}

export type AttendanceCode = "present" | "absent" | "late" | "leave"

export interface RosterStudent {
  enrollmentId: string
  studentId: string
  admissionNumber: string
  name: string
  rollNo: string | null
  status: string
  remark: string | null
  onLeave: boolean
  /** A status was saved for this student (the register was taken). */
  recorded: boolean
  active: boolean
}

export interface Roster {
  section: { id: string; name: string; classId: string; className: string }
  date: string
  /** Why there are no classes that day (holiday name, weekend), or null. */
  dayOff: string | null
  /** Past the lock window: changes need `attendance:edit_locked`. */
  locked: boolean
  register: { id: string; submittedAt: string | null } | null
  students: RosterStudent[]
}

export const attendanceKeys = {
  all: ["attendance"] as const,
  status: (date: string) => ["attendance", "status", date] as const,
  roster: (sectionId: string, date: string) =>
    ["attendance", "roster", sectionId, date] as const,
}

export const submissionStatusQuery = (date: string) =>
  queryOptions({
    queryKey: attendanceKeys.status(date),
    queryFn: ({ signal }) =>
      apiFetch<SubmissionStatus>("/attendance/submission-status", {
        signal,
        query: { date },
      }),
  })

export const rosterQuery = (sectionId: string, date: string) =>
  queryOptions({
    queryKey: attendanceKeys.roster(sectionId, date),
    queryFn: ({ signal }) =>
      apiFetch<Roster>(`/attendance/sections/${sectionId}`, {
        signal,
        query: { date },
      }),
  })

export interface AttendanceEntry {
  enrollmentId: string
  status: AttendanceCode
}

/** Saves a register; `reason` is required when a saved status changes. */
export const saveAttendance = (
  sectionId: string,
  date: string,
  records: AttendanceEntry[],
  reason?: string
) =>
  apiFetch<unknown>(`/attendance/sections/${sectionId}`, {
    method: "PUT",
    query: { date },
    body: { records, ...(reason ? { reason } : {}) },
  })

export type CountsAs = "present" | "absent" | "late" | "leave" | "half_day"

export interface MonthlyRegister {
  section: { id: string; name: string; className: string; session: string }
  month: string
  days: {
    date: string
    day: number
    weekday: string
    off: "holiday" | "weekend" | null
    offName: string | null
    taken: boolean
    attended: number
  }[]
  students: {
    enrollmentId: string
    rollNo: string | null
    name: string
    admissionNumber: string
    cells: string[]
    days: number
    present: number
    absent: number
    late: number
    leave: number
    halfDay: number
    percentage: number | null
  }[]
  legend: { symbol: string; label: string; countsAs: CountsAs }[]
}

export const monthlyRegisterQuery = (sectionId: string, month: string) =>
  queryOptions({
    queryKey: ["attendance", "register", sectionId, month] as const,
    queryFn: ({ signal }) =>
      apiFetch<MonthlyRegister>("/attendance/reports/monthly-register", {
        signal,
        query: { sectionId, month },
      }),
  })
