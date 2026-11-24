import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"
import { isApiError } from "~/lib/api/errors"

// Sessions, classes and sections (backend/src/modules/academic-years,
// classes, sections). Only what onboarding needs so far; the academics
// screens extend it.

export interface AcademicYear {
  id: string
  name: string
  code: string | null
  /** `YYYY-MM-DD`. */
  startDate: string | null
  endDate: string | null
  isCurrent: boolean
  isActive: boolean
}

export interface SchoolClass {
  id: string
  name: string
  code: string | null
  level: number | null
  isActive: boolean
}

export interface Section {
  id: string
  academicYearId: string
  classId: string
  name: string
  capacity: number | null
  isActive: boolean
}

export type ClassSubjectType = "compulsory" | "optional" | "fourth" | "elective"

/** A subject a class offers in a session (`GET /class-subjects`). */
export interface ClassSubject {
  id: string
  classId: string
  subjectId: string
  academicYearId: string
  subjectType: ClassSubjectType
  subject: { id: string; name: string; code: string | null }
  subjectGroup?: { id: string; name: string } | null
}

/** The backend's page size limit; setup lists fit in one page. */
const ALL = { page: 1, limit: 100 }

export const academicKeys = {
  currentSession: ["academics", "sessions", "current"] as const,
  classes: ["academics", "classes"] as const,
  sections: (academicYearId: string) =>
    ["academics", "sections", { academicYearId }] as const,
  classSubjects: (academicYearId: string) =>
    ["academics", "class-subjects", { academicYearId }] as const,
  holidays: (from: string, to: string) =>
    ["academics", "holidays", { from, to }] as const,
}

/** The session marked current, or null when there is none. */
export const currentSessionQuery = () =>
  queryOptions({
    queryKey: academicKeys.currentSession,
    queryFn: async ({ signal }) => {
      try {
        return await apiFetch<AcademicYear>("/academic-years/current", {
          signal,
        })
      } catch (error) {
        if (isApiError(error) && error.code === "NO_CURRENT_SESSION") {
          return null
        }
        throw error
      }
    },
  })

/** Classes by level, then name. */
export const classesQuery = () =>
  queryOptions({
    queryKey: academicKeys.classes,
    queryFn: async ({ signal }) =>
      (await apiFetchPage<SchoolClass>("/classes", { signal, query: ALL }))
        .items,
  })

export const sectionsQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: academicKeys.sections(academicYearId),
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<Section>("/sections", {
          signal,
          query: { ...ALL, academicYearId },
        })
      ).items,
  })

export interface NewSession {
  name: string
  startDate: string
  endDate: string
  isCurrent?: boolean
}

export const createSession = (body: NewSession) =>
  apiFetch<AcademicYear>("/academic-years", { method: "POST", body })

/** Name or dates; refused (409) when they overlap another session. */
export const updateSession = (id: string, body: Partial<NewSession>) =>
  apiFetch<AcademicYear>(`/academic-years/${id}`, { method: "PATCH", body })

/** A day or run of days without classes (`GET /holidays`). */
export interface Holiday {
  id: string
  name: string
  nameBn: string | null
  type: "public" | "school" | "religious"
  /** `YYYY-MM-DD`, inclusive. */
  dateFrom: string
  dateTo: string
}

export interface HolidayInput {
  name: string
  type: Holiday["type"]
  dateFrom: string
  /** Inclusive; defaults to `dateFrom`. */
  dateTo?: string
}

export const createHoliday = (body: HolidayInput) =>
  apiFetch<Holiday>("/holidays", { method: "POST", body })

export const updateHoliday = (id: string, body: Partial<HolidayInput>) =>
  apiFetch<Holiday>(`/holidays/${id}`, { method: "PATCH", body })

export const deleteHoliday = (id: string) =>
  apiFetch<void>(`/holidays/${id}`, { method: "DELETE" })

/** Holidays touching `from`–`to` (a session has well under 100). */
export const holidaysQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: academicKeys.holidays(from, to),
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<Holiday>("/holidays", {
          signal,
          query: { ...ALL, from, to },
        })
      ).items,
  })

export const createClass = (body: { name: string; level?: number }) =>
  apiFetch<SchoolClass>("/classes", { method: "POST", body })

export const createSection = (body: {
  academicYearId: string
  classId: string
  name: string
}) => apiFetch<Section>("/sections", { method: "POST", body })

/** Also removes its sections and class subjects; refused while in use. */
export const deleteClass = (id: string) =>
  apiFetch<void>(`/classes/${id}`, { method: "DELETE" })

/** Refused (409) while students are enrolled in it. */
export const deleteSection = (id: string) =>
  apiFetch<void>(`/sections/${id}`, { method: "DELETE" })

/**
 * Every class subject of a session. A curriculum template gives ten
 * classes a dozen subjects each, more than one page, so this reads them all.
 */
export const classSubjectsQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: academicKeys.classSubjects(academicYearId),
    queryFn: async ({ signal }) => {
      const items: ClassSubject[] = []
      for (let page = 1; ; page++) {
        const result = await apiFetchPage<ClassSubject>("/class-subjects", {
          signal,
          query: { page, limit: ALL.limit, academicYearId },
        })
        items.push(...result.items)
        if (page >= result.meta.totalPages) return items
      }
    },
  })

export const deleteClassSubject = (id: string) =>
  apiFetch<void>(`/class-subjects/${id}`, { method: "DELETE" })

// ---------------------------------------------------------------------------
// Academic setup screens (`/dashboard/academics/*`): full lists and writes.

/** Reads every page of a setup list (the backend caps a page at 100). */
export async function fetchAll<T>(
  path: string,
  signal: AbortSignal,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await apiFetchPage<T>(path, {
      signal,
      query: { ...query, page, limit: ALL.limit },
    })
    items.push(...result.items)
    if (page >= result.meta.totalPages) return items
  }
}

export const setupKeys = {
  sessions: ["academics", "sessions"] as const,
  terms: (academicYearId: string) =>
    ["academics", "terms", { academicYearId }] as const,
  shifts: ["academics", "shifts"] as const,
  rooms: ["academics", "rooms"] as const,
  subjects: ["academics", "subjects"] as const,
  subjectGroups: ["academics", "subject-groups"] as const,
  sectionsOf: (academicYearId: string, classId: string) =>
    ["academics", "sections", { academicYearId, classId }] as const,
  curriculum: (academicYearId: string, classId: string) =>
    ["academics", "class-subjects", { academicYearId, classId }] as const,
  classTeachers: (sectionId: string) =>
    ["academics", "class-teachers", { sectionId }] as const,
  subjectTeachers: (sectionId: string) =>
    ["academics", "subject-teachers", { sectionId }] as const,
  teachers: ["academics", "teachers"] as const,
}

export interface AcademicYearRow extends AcademicYear {
  description: string | null
}

export interface Term {
  id: string
  academicYearId: string
  name: string
  startDate: string
  endDate: string
  sortOrder: number
}

export interface Shift {
  id: string
  name: string
  /** `HH:mm` (the API may add seconds). */
  startTime: string
  endTime: string
  sortOrder: number
}

export const ROOM_TYPES = [
  "classroom",
  "lab",
  "hall",
  "library",
  "office",
  "other",
] as const
export type RoomType = (typeof ROOM_TYPES)[number]

export interface Room {
  id: string
  name: string
  building: string | null
  capacity: number | null
  type: RoomType
  isActive: boolean
}

export const SUBJECT_TYPES = ["theory", "practical", "lab", "activity"] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export interface Subject {
  id: string
  name: string
  code: string | null
  type: SubjectType
  credit: number | null
  description: string | null
  isActive: boolean
}

export interface SubjectGroup {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
}

export interface SectionRow extends Section {
  shiftId: string | null
  roomId: string | null
  shift: { id: string; name: string } | null
  room: { id: string; name: string } | null
}

export const CLASS_SUBJECT_TYPES: ClassSubjectType[] = [
  "compulsory",
  "optional",
  "fourth",
  "elective",
]

export interface CurriculumRow extends ClassSubject {
  subjectGroupId: string | null
  weeklyClasses: number | null
  passMarks: number | null
  fullMarks: number | null
}

export interface Teacher {
  id: string
  fullName: string
  employeeNumber: string | null
  status: string
}

interface Assignment {
  id: string
  sectionId: string
  employeeId: string
  employee: { id: string; fullName: string }
  effectiveFrom: string
  effectiveTo: string | null
}

export interface ClassTeacherRow extends Assignment {
  isPrimary: boolean
}

export interface SubjectTeacherRow extends Assignment {
  classSubjectId: string
}

const write =
  <B>(path: string) =>
  (body: B) =>
    apiFetch<unknown>(path, { method: "POST", body })
const patch =
  <B>(path: string) =>
  (id: string, body: B) =>
    apiFetch<unknown>(`${path}/${id}`, { method: "PATCH", body })
const remove = (path: string) => (id: string) =>
  apiFetch<void>(`${path}/${id}`, { method: "DELETE" })

type Body = Record<string, unknown>

export const sessionsApi = {
  list: (signal: AbortSignal) =>
    fetchAll<AcademicYearRow>("/academic-years", signal),
  create: write<Body>("/academic-years"),
  update: patch<Body>("/academic-years"),
  remove: remove("/academic-years"),
}
export const termsApi = {
  list: (academicYearId: string, signal: AbortSignal) =>
    fetchAll<Term>("/terms", signal, { academicYearId }),
  create: write<Body>("/terms"),
  update: patch<Body>("/terms"),
  remove: remove("/terms"),
}
export const shiftsApi = {
  list: (signal: AbortSignal) => fetchAll<Shift>("/shifts", signal),
  create: write<Body>("/shifts"),
  update: patch<Body>("/shifts"),
  remove: remove("/shifts"),
}
export const roomsApi = {
  list: (signal: AbortSignal) => fetchAll<Room>("/rooms", signal),
  create: write<Body>("/rooms"),
  update: patch<Body>("/rooms"),
  remove: remove("/rooms"),
}
export const subjectsApi = {
  list: (signal: AbortSignal) => fetchAll<Subject>("/subjects", signal),
  create: write<Body>("/subjects"),
  update: patch<Body>("/subjects"),
  remove: remove("/subjects"),
}
export const subjectGroupsApi = {
  list: (signal: AbortSignal) =>
    fetchAll<SubjectGroup>("/subject-groups", signal),
  create: write<Body>("/subject-groups"),
  update: patch<Body>("/subject-groups"),
  remove: remove("/subject-groups"),
}
export const classesApi = {
  list: async (signal: AbortSignal) =>
    (await fetchAll<SchoolClass>("/classes", signal)).sort(
      (a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name)
    ),
  create: write<Body>("/classes"),
  update: patch<Body>("/classes"),
  remove: remove("/classes"),
}
export const sectionsApi = {
  list: async (academicYearId: string, classId: string, signal: AbortSignal) =>
    (
      await fetchAll<SectionRow>("/sections", signal, {
        academicYearId,
        classId,
      })
    ).sort((a, b) => a.name.localeCompare(b.name)),
  create: write<Body>("/sections"),
  update: patch<Body>("/sections"),
  remove: remove("/sections"),
}
export const curriculumApi = {
  list: async (academicYearId: string, classId: string, signal: AbortSignal) =>
    (
      await fetchAll<CurriculumRow>("/class-subjects", signal, {
        academicYearId,
        classId,
      })
    ).sort((a, b) => a.subject.name.localeCompare(b.subject.name)),
  create: write<Body>("/class-subjects"),
  update: patch<Body>("/class-subjects"),
  remove: remove("/class-subjects"),
}

/** Active staff, by name: anyone can be given a class or subject. */
export const teachersQuery = () =>
  queryOptions({
    queryKey: setupKeys.teachers,
    queryFn: async ({ signal }) =>
      (await fetchAll<Teacher>("/employees", signal, { status: "active" }))
        .filter((e) => e.status === "active")
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
  })

export const classTeachersQuery = (sectionId: string) =>
  queryOptions({
    queryKey: setupKeys.classTeachers(sectionId),
    queryFn: ({ signal }) =>
      fetchAll<ClassTeacherRow>("/class-teachers", signal, {
        sectionId,
        current: true,
      }),
    enabled: Boolean(sectionId),
  })

export const subjectTeachersQuery = (sectionId: string) =>
  queryOptions({
    queryKey: setupKeys.subjectTeachers(sectionId),
    queryFn: ({ signal }) =>
      fetchAll<SubjectTeacherRow>("/subject-teachers", signal, {
        sectionId,
        current: true,
      }),
    enabled: Boolean(sectionId),
  })

export const assignClassTeacher = (body: {
  sectionId: string
  employeeId: string
  isPrimary?: boolean
}) => apiFetch<unknown>("/class-teachers", { method: "POST", body })

/** Ends today's row and opens a new one from today (history is kept). */
export const changeClassTeacher = (
  id: string,
  body: { employeeId?: string; isPrimary?: boolean }
) => apiFetch<unknown>(`/class-teachers/${id}`, { method: "PATCH", body })

export const endClassTeacher = (id: string) =>
  apiFetch<unknown>(`/class-teachers/${id}/end`, { method: "POST", body: {} })

export const assignSubjectTeacher = (body: {
  sectionId: string
  classSubjectId: string
  employeeId: string
}) => apiFetch<unknown>("/subject-teachers", { method: "POST", body })

export const changeSubjectTeacher = (id: string, employeeId: string) =>
  apiFetch<unknown>(`/subject-teachers/${id}`, {
    method: "PATCH",
    body: { employeeId },
  })

export const endSubjectTeacher = (id: string) =>
  apiFetch<unknown>(`/subject-teachers/${id}/end`, {
    method: "POST",
    body: {},
  })
