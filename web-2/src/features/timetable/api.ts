import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

export const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
export type Day = (typeof DAYS)[number]

export interface TimetableGrid {
  section: {
    id: string
    name: string
    classId: string
    className: string
    academicYearId: string
  }
  days: Day[]
  periods: {
    id: string
    name: string
    startTime: string | null
    endTime: string | null
  }[]
  slots: {
    id: string
    dayOfWeek: Day
    periodId: string
    subjectId: string
    subjectName: string
    employeeId: string
    teacherName: string
  }[]
  published: { at: string } | null
}

export const timetableKeys = {
  all: ["timetable"] as const,
  grid: (sectionId: string) => ["timetable", sectionId] as const,
}

export const timetableQuery = (sectionId: string) =>
  queryOptions({
    queryKey: timetableKeys.grid(sectionId),
    queryFn: ({ signal }) =>
      apiFetch<TimetableGrid>(`/timetables/sections/${sectionId}`, { signal }),
  })

export interface SubjectTeacherRow {
  id: string
  sectionId: string
  classSubjectId: string
  employeeId: string
  effectiveTo: string | null
}

export const sectionSubjectTeachersQuery = (sectionId: string) =>
  queryOptions({
    queryKey: ["timetable", "subject-teachers", sectionId] as const,
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<SubjectTeacherRow>("/subject-teachers", {
          signal,
          query: { sectionId, page: 1, limit: 100 },
        })
      ).items.filter((r) => !r.effectiveTo),
  })

export const saveSlot = (
  slotId: string | null,
  body: {
    academicYearId: string
    classId: string
    sectionId: string
    dayOfWeek: Day
    periodId: string
    subjectId: string
    employeeId: string
  }
) =>
  slotId
    ? apiFetch(`/timetables/${slotId}`, {
        method: "PATCH",
        body: { subjectId: body.subjectId, employeeId: body.employeeId },
      })
    : apiFetch("/timetables", { method: "POST", body })

export const clearSlot = (slotId: string) =>
  apiFetch<void>(`/timetables/${slotId}`, { method: "DELETE" })

export const publishTimetable = (sectionId: string, publish: boolean) =>
  apiFetch<TimetableGrid>(`/timetables/sections/${sectionId}/publish`, {
    method: publish ? "POST" : "DELETE",
  })

/** `monday`… for a `YYYY-MM-DD` day. */
export const dayOf = (date: string): Day =>
  DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]
