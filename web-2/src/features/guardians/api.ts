import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Guardians (backend/src/modules/guardians).

export const RELATIONS = [
  "father",
  "mother",
  "local_guardian",
  "brother",
  "sister",
  "other",
] as const
export type Relation = (typeof RELATIONS)[number]

export interface GuardianChild {
  studentId: string
  admissionNumber: string
  name: string
  status: string
  relation: Relation
  isPrimary: boolean
  className: string | null
  sectionName: string | null
}

export interface GuardianRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  occupation: string | null
  income: number | null
  userId: string | null
  user: { id: string; status: string; passwordSet: boolean } | null
  children: GuardianChild[]
}

export interface GuardianFilter {
  q: string
  portal: "" | "yes" | "no"
  page: number
}

export const GUARDIANS_PAGE_SIZE = 25

export const guardianKeys = {
  all: ["guardians"] as const,
  list: (filter: GuardianFilter) => ["guardians", filter] as const,
}

export const guardiansQuery = (filter: GuardianFilter) =>
  queryOptions({
    queryKey: guardianKeys.list(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<GuardianRow>("/guardians", {
        signal,
        query: {
          q: filter.q || undefined,
          portal: filter.portal || undefined,
          page: filter.page,
          limit: GUARDIANS_PAGE_SIZE,
          withChildren: "true",
        },
      }),
    placeholderData: keepPreviousData,
  })

export const updateGuardian = (id: string, body: Record<string, unknown>) =>
  apiFetch<GuardianRow>(`/guardians/${id}`, { method: "PATCH", body })

/** A new one-time portal password (the parent changes it on first use). */
export const issuePortalSlip = (id: string) =>
  apiFetch<{ temporaryPassword: string }>(`/guardians/${id}/portal-slip`, {
    method: "POST",
    body: {},
  })
