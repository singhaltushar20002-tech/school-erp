import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export const EVENT_KINDS = [
  "event",
  "ptm",
  "activity",
  "sports",
  "meeting",
] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export interface CalendarItem {
  kind: "holiday" | "exam" | "event"
  id: string
  title: string
  dateFrom: string
  dateTo: string
  eventKind: EventKind | null
  description: string | null
  forParents: boolean
  classIds: string[]
}

export interface CalendarMonth {
  month: string
  items: CalendarItem[]
}

export const calendarKeys = {
  all: ["calendar"] as const,
  month: (month: string, classId: string) =>
    ["calendar", month, classId] as const,
}

export const calendarQuery = (month: string, classId = "") =>
  queryOptions({
    queryKey: calendarKeys.month(month, classId),
    queryFn: ({ signal }) =>
      apiFetch<CalendarMonth>("/calendar", {
        signal,
        query: { month, ...(classId ? { classId } : {}) },
      }),
  })

export interface EventInput {
  title: string
  description?: string | null
  kind: EventKind
  dateFrom: string
  dateTo?: string
  classIds?: string[]
  forParents?: boolean
}

export const addEvent = (body: EventInput) =>
  apiFetch<{ id: string }>("/school-events", { method: "POST", body })

export const removeEvent = (id: string) =>
  apiFetch<void>(`/school-events/${id}`, { method: "DELETE" })

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Every day of the month, Monday-first weeks padded with nulls. */
export function monthWeeks(month: string): (string | null)[][] {
  const [y, m] = month.split("-").map(Number)
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const first = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: first }, () => null)
  for (let d = 1; d <= days; d++)
    cells.push(`${month}-${String(d).padStart(2, "0")}`)
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
