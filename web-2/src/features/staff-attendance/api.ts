import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export const STAFF_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "leave",
  "unpaid_leave",
] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid"] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]

export interface StaffDay {
  date: string
  staff: {
    id: string
    name: string
    employeeNumber: string | null
    designation: string | null
    status: StaffStatus | null
  }[]
}

export interface StaffLeave {
  id: string
  employeeId: string
  employeeName: string
  designation: string | null
  fromDate: string
  toDate: string
  leaveType: LeaveType
  reason: string | null
  status: "pending" | "approved" | "rejected"
}

export interface UncoveredPeriods {
  date: string
  absentTeachers: number
  periods: {
    timetableId: string
    periodName: string
    startTime: string | null
    className: string
    sectionName: string
    subjectName: string
    teacherName: string
    substitute: { id: string; name: string } | null
    free: { id: string; name: string }[]
  }[]
}

export const staffKeys = {
  all: ["staff-attendance"] as const,
  day: (date: string) => ["staff-attendance", "day", date] as const,
  leaves: (status: string) => ["staff-attendance", "leaves", status] as const,
  subs: (date: string) => ["staff-attendance", "subs", date] as const,
}

export const staffDayQuery = (date: string) =>
  queryOptions({
    queryKey: staffKeys.day(date),
    queryFn: ({ signal }) =>
      apiFetch<StaffDay>("/staff-attendance", { signal, query: { date } }),
  })

export const markStaff = (
  date: string,
  records: { employeeId: string; status: StaffStatus }[]
) =>
  apiFetch<StaffDay>("/staff-attendance", {
    method: "PUT",
    body: { date, records },
  })

export const staffLeavesQuery = (status: string) =>
  queryOptions({
    queryKey: staffKeys.leaves(status),
    queryFn: ({ signal }) =>
      apiFetch<StaffLeave[]>("/staff-leaves", {
        signal,
        query: status === "all" ? {} : { status },
      }),
  })

export const addStaffLeave = (body: {
  employeeId: string
  fromDate: string
  toDate?: string
  leaveType: LeaveType
  reason?: string
  approved?: boolean
}) => apiFetch<StaffLeave>("/staff-leaves", { method: "POST", body })

export const decideStaffLeave = (id: string, approve: boolean) =>
  apiFetch<StaffLeave>(`/staff-leaves/${id}/decision`, {
    method: "POST",
    body: { approve },
  })

export const uncoveredQuery = (date: string) =>
  queryOptions({
    queryKey: staffKeys.subs(date),
    queryFn: ({ signal }) =>
      apiFetch<UncoveredPeriods>("/substitutions", { signal, query: { date } }),
  })

export const assignSubstitute = (
  date: string,
  timetableId: string,
  employeeId: string | null
) =>
  apiFetch<UncoveredPeriods>("/substitutions", {
    method: "PUT",
    body: { date, timetableId, employeeId },
  })
