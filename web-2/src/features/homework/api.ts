import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export interface HomeworkItem {
  id: string
  sectionId: string
  sectionName: string
  classId: string | null
  className: string
  classSubjectId: string
  subjectName: string
  title: string
  description: string | null
  assignedOn: string
  dueDate: string
  attachments: number
  submitted: number
  students: number | null
}

export interface HomeworkDetail extends HomeworkItem {
  attachmentLinks: { fileId: string; name: string; url: string }[]
  roster: {
    enrollmentId: string
    rollNo: string | null
    name: string
    submitted: boolean
  }[]
}

export interface HomeworkOption {
  sectionId: string
  sectionName: string
  className: string
  classSubjectId: string
  subjectName: string
}

export const homeworkKeys = {
  all: ["homework"] as const,
  list: ["homework", "list"] as const,
  options: ["homework", "options"] as const,
  detail: (id: string) => ["homework", id] as const,
}

export const homeworkListQuery = () =>
  queryOptions({
    queryKey: homeworkKeys.list,
    queryFn: ({ signal }) => apiFetch<HomeworkItem[]>("/homework", { signal }),
  })

export const homeworkOptionsQuery = () =>
  queryOptions({
    queryKey: homeworkKeys.options,
    queryFn: ({ signal }) =>
      apiFetch<HomeworkOption[]>("/homework/options", { signal }),
  })

export const homeworkQuery = (id: string) =>
  queryOptions({
    queryKey: homeworkKeys.detail(id),
    queryFn: ({ signal }) =>
      apiFetch<HomeworkDetail>(`/homework/${id}`, { signal }),
  })

export const uploadHomeworkFile = async (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return apiFetch<{ fileId: string }>("/homework/attachments", {
    method: "POST",
    body: form,
  })
}

export const setHomework = (body: {
  sectionId: string
  classSubjectId: string
  title: string
  description?: string | null
  dueDate: string
  attachmentFileIds?: string[]
}) => apiFetch<HomeworkDetail>("/homework", { method: "POST", body })

export const saveSubmissions = (id: string, enrollmentIds: string[]) =>
  apiFetch<HomeworkDetail>(`/homework/${id}/submissions`, {
    method: "PUT",
    body: { enrollmentIds },
  })

export const deleteHomework = (id: string) =>
  apiFetch<void>(`/homework/${id}`, { method: "DELETE" })
