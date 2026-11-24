import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Communication log and message templates (backend/src/modules/notifications).

export const EVENTS = [
  "absent",
  "feeDue",
  "paymentReceived",
  "resultPublished",
  "noticePublished",
] as const
export type NotificationEvent = (typeof EVENTS)[number]

export interface DeliveryLog {
  id: string
  channel: "in_app" | "email"
  userId: string | null
  recipient: string
  recipientName: string | null
  templateKey: NotificationEvent | null
  subject: string | null
  status: "queued" | "sent" | "failed"
  error: string | null
  attempts: number
  sentAt: string | null
  createdAt: string
}

export interface LogFilter {
  channel: "" | "in_app" | "email"
  status: "" | "queued" | "sent" | "failed"
  templateKey: NotificationEvent | ""
  from: string
  to: string
  page: number
}

export const LOG_PAGE_SIZE = 50

export interface Template {
  id: string | null
  key: NotificationEvent
  channel: "inApp" | "email"
  locale: "en" | "hi" | "bn"
  subject: string
  body: string
  custom: boolean
}

export const communicationKeys = {
  log: (filter: LogFilter) => ["communication", "log", filter] as const,
  templates: ["communication", "templates"] as const,
}

export const logQuery = (filter: LogFilter) =>
  queryOptions({
    queryKey: communicationKeys.log(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<DeliveryLog>("/communication-log", {
        signal,
        query: {
          channel: filter.channel || undefined,
          status: filter.status || undefined,
          templateKey: filter.templateKey || undefined,
          from: filter.from || undefined,
          to: filter.to || undefined,
          page: filter.page,
          limit: LOG_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const templatesQuery = () =>
  queryOptions({
    queryKey: communicationKeys.templates,
    queryFn: ({ signal }) =>
      apiFetch<Template[]>("/notification-templates", { signal }),
  })

export const saveTemplate = (body: {
  key: NotificationEvent
  channel: Template["channel"]
  locale: Template["locale"]
  subject: string
  body: string
}) => apiFetch<Template>("/notification-templates", { method: "PUT", body })

/** Back to the built-in wording. */
export const resetTemplate = (id: string) =>
  apiFetch<void>(`/notification-templates/${id}`, { method: "DELETE" })

/** The `{placeholders}` each message can use. */
export const PLACEHOLDERS: Record<NotificationEvent, string[]> = {
  absent: ["student_name", "class_name", "date"],
  feeDue: ["student_name", "amount", "due_date"],
  paymentReceived: ["student_name", "amount", "receipt_number"],
  resultPublished: ["student_name", "result_name"],
  noticePublished: ["title", "summary"],
}
