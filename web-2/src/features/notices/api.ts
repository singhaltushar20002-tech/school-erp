import { queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Circulars (backend `notices`): the office posts to the whole school,
// parents, staff or a class; families see them in the portal, and the
// notification service sends them on.

export type AudienceType =
  | "all"
  | "staff"
  | "guardians"
  | "students"
  | "class"
  | "section"
  | "role"
  | "group"
  | "users"

export interface Notice {
  id: string
  title: string
  body: string
  audience: { type: AudienceType; ids: string[] }
  publishAt: string
  pinned: boolean
  createdAt: string
}

export interface NewNotice {
  title: string
  body: string
  audience: { type: AudienceType; ids?: string[] }
  pinned?: boolean
}

export const noticeKeys = { all: ["notices"] as const }

export const noticesQuery = () =>
  queryOptions({
    queryKey: noticeKeys.all,
    queryFn: async ({ signal }) =>
      (
        await apiFetchPage<Notice>("/notices", {
          signal,
          query: { limit: 50 },
        })
      ).items,
  })

export const postNotice = (body: NewNotice) =>
  apiFetch<Notice>("/notices", { method: "POST", body })
