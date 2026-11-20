import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Student leave requests (backend attendance `student-leaves`): parents
// apply in the portal, the class teacher approves or rejects, and an
// approved leave marks the days Leave in the register.

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled"

export interface LeaveRequest {
  id: string
  fromDate: string
  toDate: string
  reason: string
  status: LeaveStatus
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
  student: { id: string; fullName: string; admissionNumber: string }
  enrollment: {
    rollNo: string | null
    section: { name: string; schoolClass: { name: string } }
  }
}

export const leaveKeys = {
  all: ["leaves"] as const,
  list: (status: LeaveStatus | "all") => ["leaves", status] as const,
}

export const leavesQuery = (status: LeaveStatus | "all") =>
  queryOptions({
    queryKey: leaveKeys.list(status),
    queryFn: ({ signal }) =>
      apiFetchPage<LeaveRequest>("/student-leaves", {
        signal,
        query: {
          status: status === "all" ? undefined : status,
          limit: 100,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const decideLeave = (
  id: string,
  decision: "approve" | "reject",
  note?: string
) =>
  apiFetch<LeaveRequest>(`/student-leaves/${id}/${decision}`, {
    method: "POST",
    body: note ? { note } : {},
  })

/** Days from `from` to `to`, both included. */
export const leaveDays = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
