import { queryOptions } from "@tanstack/react-query"

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
  sectionId: string
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
      body: { sectionId },
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
