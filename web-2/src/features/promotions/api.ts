import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Year-end promotion (backend/src/modules/promotions) and session
// rollover (backend/src/modules/rollover).

export const OUTCOMES = [
  "promote",
  "conditional",
  "detain",
  "graduate",
] as const
export type Outcome = (typeof OUTCOMES)[number]
export const ROLL_BY = ["merit", "keep", "alphabetical"] as const
export type RollBy = (typeof ROLL_BY)[number]

export interface PromotionBatch {
  id: string
  fromYearId: string
  toYearId: string
  classId: string
  status: "draft" | "committed" | "rolled_back"
  options: { rollBy: RollBy; shuffleSections: boolean }
  committedAt: string | null
  rolledBackAt: string | null
  createdAt: string
}

export interface PromotionItem {
  id: string
  studentId: string
  student: { id: string; fullName: string; admissionNumber: string }
  enrollment: {
    rollNo: string | null
    section: { id: string; name: string } | null
  } | null
  outcome: Outcome
  toClassId: string | null
  toClass: { id: string; name: string } | null
  toSectionId: string | null
  newRoll: string | null
  overridden: boolean
  note: string | null
}

export interface PromotionPreview extends PromotionBatch {
  items: PromotionItem[]
  summary: Record<Outcome, number>
}

export const promotionKeys = {
  all: ["promotions"] as const,
  batches: (fromYearId: string) =>
    ["promotions", "batches", { fromYearId }] as const,
  batch: (id: string) => ["promotions", "batch", id] as const,
}

export const batchesQuery = (fromYearId: string) =>
  queryOptions({
    queryKey: promotionKeys.batches(fromYearId),
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<PromotionBatch>("/promotions/batches", {
          signal,
          query: { fromYearId, page: 1, limit: 100 },
        })
      ).items,
    enabled: Boolean(fromYearId),
  })

export const batchQuery = (id: string) =>
  queryOptions({
    queryKey: promotionKeys.batch(id),
    queryFn: ({ signal }) =>
      apiFetch<PromotionPreview>(`/promotions/batches/${id}`, { signal }),
    enabled: Boolean(id),
  })

export const createBatch = (body: {
  fromYearId: string
  toYearId: string
  classId: string
  options: { rollBy: RollBy; shuffleSections: boolean }
}) =>
  apiFetch<PromotionPreview>("/promotions/batches", { method: "POST", body })

export const updateItem = (
  batchId: string,
  itemId: string,
  body: { outcome?: Outcome; toSectionId?: string; newRoll?: string | null }
) =>
  apiFetch<unknown>(`/promotions/batches/${batchId}/items/${itemId}`, {
    method: "PATCH",
    body,
  })

export const deleteBatch = (id: string) =>
  apiFetch<void>(`/promotions/batches/${id}`, { method: "DELETE" })

export const rollbackBatch = (id: string) =>
  apiFetch<PromotionPreview>(`/promotions/batches/${id}/rollback`, {
    method: "POST",
    body: {},
  })

type Job = {
  id: string
  status: string
  error?: string | null
  result?: unknown
}

/** Runs a job endpoint and waits until it finishes. */
async function runJob(path: string, body: Record<string, unknown>) {
  const started = await apiFetch<Job | { job: Job }>(path, {
    method: "POST",
    body,
  })
  let job = "job" in started ? started.job : started
  for (let i = 0; i < 180 && job.status !== "succeeded"; i++) {
    if (job.status === "failed") throw new Error(job.error ?? "failed")
    await new Promise((r) => setTimeout(r, 1000))
    job = await apiFetch<Job>(`/jobs/${job.id}`)
  }
  if (job.status !== "succeeded") throw new Error("timed out")
  return job
}

/** Creates the new session's enrollments (rollback allowed for 24 h). */
export const commitBatch = (id: string) =>
  runJob(`/promotions/batches/${id}/commit`, {})

/**
 * Copies this session's sections, curriculum and teachers into the next
 * one, so promoted students have sections to go to.
 */
export const rolloverSession = (targetId: string, fromYearId: string) =>
  runJob(`/academic-years/${targetId}/rollover`, {
    fromYearId,
    include: { sections: true, curriculum: true, teachers: true },
    mode: "merge",
  })
