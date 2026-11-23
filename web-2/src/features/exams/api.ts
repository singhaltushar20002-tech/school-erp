import { queryOptions } from "@tanstack/react-query"

import { runExport } from "~/features/exports/export-button"
import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Exams for staff (backend `exams`): mark sheets per subject and section,
// the marks grid, approval, results per class and report cards.

export type ExamStatus = "draft" | "open" | "closed"
export type SheetStatus =
  "draft" | "submitted" | "verified" | "approved" | "published"

export interface Exam {
  id: string
  name: string
  status: ExamStatus
  startDate: string | null
  endDate: string | null
  createdAt: string
}

export interface SheetRow {
  id: string
  classId: string
  classSubjectId: string
  subjectName: string
  sectionId: string
  sectionName: string
  status: SheetStatus
  submittedAt: string | null
  approvedAt: string | null
  teacherName: string | null
}

export interface MarkValue {
  value: number | null
  absent: boolean
  exempt: boolean
}

export interface MarkGrid {
  sheet: {
    id: string
    status: SheetStatus
    sectionName: string
    className: string
    examName: string
    subjectName: string
  }
  subject: {
    fullMarks: number
    components: {
      id: string
      component: string
      fullMarks: number
      passMarks: number | null
    }[]
  }
  students: {
    enrollmentId: string
    name: string
    rollNo: string | null
    active: boolean
    marks: Record<string, MarkValue>
    computed?: { letter: string | null; passed: boolean | null } | null
  }[]
}

export interface ResultDefinition {
  id: string
  academicYearId: string
  classId: string
  schoolClass: { id: string; name: string; level: number | null }
  name: string
  computedAt: string | null
  publishedAt: string | null
  status: {
    sheets: number
    approved: number
    allApproved: boolean
    current: boolean
    published: boolean
  }
}

export const examKeys = {
  all: ["exams"] as const,
  list: ["exams", "list"] as const,
  sheets: (examId: string) => ["exams", examId, "sheets"] as const,
  grid: (sheetId: string) => ["exams", "sheet", sheetId] as const,
  definitions: (examId: string) => ["exams", examId, "definitions"] as const,
}

export const examsQuery = () =>
  queryOptions({
    queryKey: examKeys.list,
    queryFn: async ({ signal }) =>
      (await apiFetchPage<Exam>("/exams", { signal, query: { limit: 100 } }))
        .items,
  })

export const sheetsQuery = (examId: string) =>
  queryOptions({
    queryKey: examKeys.sheets(examId),
    queryFn: ({ signal }) =>
      apiFetch<SheetRow[]>(`/exams/${examId}/mark-sheets`, { signal }),
  })

export const gridQuery = (sheetId: string) =>
  queryOptions({
    queryKey: examKeys.grid(sheetId),
    queryFn: ({ signal }) =>
      apiFetch<MarkGrid>(`/mark-sheets/${sheetId}/marks`, { signal }),
  })

export const definitionsQuery = (examId: string) =>
  queryOptions({
    queryKey: examKeys.definitions(examId),
    queryFn: ({ signal }) =>
      apiFetch<ResultDefinition[]>("/result-definitions", {
        signal,
        query: { examId },
      }),
  })

export interface MarkEntry {
  enrollmentId: string
  componentId: string
  value?: number | null
  absent?: boolean
}

export const saveMarks = (sheetId: string, entries: MarkEntry[]) =>
  apiFetch<unknown>(`/mark-sheets/${sheetId}/marks`, {
    method: "PUT",
    body: { entries },
  })

export const submitSheet = (sheetId: string) =>
  apiFetch<unknown>(`/mark-sheets/${sheetId}/submit`, { method: "POST" })

export const approveSheets = (markSheetIds: string[]) =>
  apiFetch<unknown>("/mark-sheets/approve", {
    method: "POST",
    body: { markSheetIds },
  })

export const publishResults = (definitionId: string) =>
  apiFetch<unknown>(`/result-definitions/${definitionId}/publish`, {
    method: "POST",
  })

/** Prints a section's report cards (a job); resolves with the PDF link. */
export async function printReportCards(
  definitionId: string,
  sectionId: string,
  language?: "en" | "hi"
): Promise<string> {
  type Job = {
    id: string
    status: string
    downloadUrl?: string | null
    error?: string | null
  }
  let job = await apiFetch<Job>(
    `/result-definitions/${definitionId}/report-cards`,
    {
      method: "POST",
      body: { sectionId, ...(language ? { language } : {}) },
    }
  )
  for (let i = 0; i < 120 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "failed")
    await new Promise((r) => setTimeout(r, 1500))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (!job.downloadUrl) throw new Error("not ready")
  return job.downloadUrl
}

// Grading systems and which class uses which (the report card follows).

export interface GradingSystem {
  id: string
  name: string
  kind: "gpa" | "letter" | "percentage"
  templateCode: string | null
  isDefault: boolean
  items: { letter: string; minPercent: number; maxPercent: number }[]
}

export interface GradingTemplate {
  code: string
  name: string
  description: string
}

export interface ClassGrading {
  id: string
  academicYearId: string
  classId: string
  gradingSystemId: string
}

export type ReportCardFormat = "cbse" | "icse" | "state" | "standard"

/** Mirrors the backend's `reportCardFormat`. */
export const reportCardFormat = (
  templateCode: string | null | undefined
): ReportCardFormat =>
  templateCode === "cbse"
    ? "cbse"
    : templateCode === "icse"
      ? "icse"
      : templateCode === "up-board" || templateCode === "percentage-division"
        ? "state"
        : "standard"

/** The templates an Indian school picks from. */
export const INDIA_TEMPLATES = ["cbse", "icse", "up-board", "cambridge"]

export const gradingKeys = {
  all: ["grading"] as const,
  systems: ["grading", "systems"] as const,
  templates: ["grading", "templates"] as const,
  classes: (yearId: string) => ["grading", "classes", yearId] as const,
}

export const gradingSystemsQuery = () =>
  queryOptions({
    queryKey: gradingKeys.systems,
    queryFn: ({ signal }) =>
      apiFetch<GradingSystem[]>("/grading-systems", { signal }),
  })

export const gradingTemplatesQuery = () =>
  queryOptions({
    queryKey: gradingKeys.templates,
    queryFn: ({ signal }) =>
      apiFetch<GradingTemplate[]>("/grading-systems/templates", { signal }),
  })

export const classGradingQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: gradingKeys.classes(academicYearId),
    queryFn: ({ signal }) =>
      apiFetch<ClassGrading[]>("/class-grading", {
        signal,
        query: { academicYearId },
      }),
  })

export const addGradingFromTemplate = (code: string) =>
  apiFetch<GradingSystem>(`/grading-systems/templates/${code}`, {
    method: "POST",
    body: {},
  })

export const makeDefaultGrading = (id: string) =>
  apiFetch<GradingSystem>(`/grading-systems/${id}`, {
    method: "PATCH",
    body: { isDefault: true },
  })

export const setClassGrading = (body: {
  academicYearId: string
  classId: string
  gradingSystemId: string
}) => apiFetch<ClassGrading>("/class-grading", { method: "PUT", body })

export const clearClassGrading = (id: string) =>
  apiFetch<void>(`/class-grading/${id}`, { method: "DELETE" })

// Report card entry: remarks and co-scholastic grades per student.

export const CO_SCHOLASTIC = [
  "work_education",
  "art_education",
  "health_physical",
  "discipline",
] as const
export type CoScholasticArea = (typeof CO_SCHOLASTIC)[number]

export interface ResultRow {
  id: string
  enrollmentId: string
  name: string
  rollNo: string | null
  sectionId: string
  sectionName: string
  total: number
  fullMarks: number
  percentage: number
  grade: string
  passed: boolean
  remarks: string | null
  coScholastic: Partial<Record<CoScholasticArea, string>> | null
}

export const allDefinitionsQuery = () =>
  queryOptions({
    queryKey: ["exams", "definitions", "all"] as const,
    queryFn: ({ signal }) =>
      apiFetch<ResultDefinition[]>("/result-definitions", { signal }),
  })

export const resultRowsQuery = (definitionId: string, sectionId: string) =>
  queryOptions({
    queryKey: ["exams", "results", definitionId, sectionId] as const,
    queryFn: ({ signal }) =>
      apiFetch<ResultRow[]>(`/result-definitions/${definitionId}/results`, {
        signal,
        query: { sectionId },
      }),
  })

export const saveRemarks = (resultId: string, remarks: string) =>
  apiFetch<ResultRow>(`/results/${resultId}/remarks`, {
    method: "PUT",
    body: { remarks },
  })

export const saveCoScholastic = (
  resultId: string,
  grades: Partial<Record<CoScholasticArea, string>>
) =>
  apiFetch<ResultRow>(`/results/${resultId}/co-scholastic`, {
    method: "PUT",
    body: grades,
  })

// Results screen (`/dashboard/exams/results`).

export interface MeritRow extends ResultRow {
  studentId: string
  admissionNumber: string
  gpa: number | null
  failedCount: number
  positionSection: number | null
  positionClass: number | null
}

export interface SubjectAnalysis {
  classSubjectId: string
  subjectName: string
  sat: number
  absent: number
  passed: number
  failed: number
  passRate: number
  average: number
  highest: number
  lowest: number
  grades: Record<string, number>
}

export const RESULT_SHEETS = [
  "merit",
  "tabulation",
  "failed",
  "analysis",
] as const
export type ResultSheet = (typeof RESULT_SHEETS)[number]

export const meritListQuery = (definitionId: string) =>
  queryOptions({
    queryKey: ["exams", "merit", definitionId] as const,
    queryFn: ({ signal }) =>
      apiFetch<MeritRow[]>(`/result-definitions/${definitionId}/merit-list`, {
        signal,
      }),
    enabled: Boolean(definitionId),
  })

export const analysisQuery = (definitionId: string) =>
  queryOptions({
    queryKey: ["exams", "analysis", definitionId] as const,
    queryFn: ({ signal }) =>
      apiFetch<SubjectAnalysis[]>(
        `/result-definitions/${definitionId}/analysis`,
        { signal }
      ),
    enabled: Boolean(definitionId),
  })

/** Computes totals, grades and positions (a job) once every sheet is approved. */
export async function tabulateResults(definitionId: string): Promise<void> {
  type Job = { id: string; status: string; error?: string | null }
  const started = await apiFetch<Job | { job: Job }>(
    `/result-definitions/${definitionId}/tabulate`,
    { method: "POST", body: {} }
  )
  let job = "job" in started ? started.job : started
  for (let i = 0; i < 120 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
}

/** A result sheet as Excel or PDF; resolves with the download link. */
export const exportResults = (
  definitionId: string,
  type: ResultSheet,
  format: "xlsx" | "pdf"
) => runExport(`/result-definitions/${definitionId}/exports`, { type, format })
