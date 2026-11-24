import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

export const STAGES = [
  "new",
  "contacted",
  "visited",
  "admitted",
  "lost",
] as const
export type Stage = (typeof STAGES)[number]

export const SOURCES = [
  "walk_in",
  "phone",
  "website",
  "referral",
  "social",
  "other",
] as const
export type Source = (typeof SOURCES)[number]

export interface Enquiry {
  id: string
  studentName: string
  dateOfBirth: string | null
  gender: "male" | "female" | "other" | null
  classId: string | null
  className?: string | null
  guardianName: string
  phone: string
  email: string | null
  previousSchool: string | null
  source: Source
  stage: Stage
  notes: string | null
  followUpOn: string | null
  lostReason: string | null
  admittedStudentId: string | null
  createdAt: string
}

export interface EnquiryInput {
  studentName: string
  dateOfBirth?: string | null
  gender?: string | null
  classId?: string | null
  guardianName: string
  phone: string
  email?: string | null
  previousSchool?: string | null
  source: Source
  notes?: string | null
  followUpOn?: string | null
}

export const enquiryKeys = {
  all: ["enquiries"] as const,
  list: ["enquiries", "list"] as const,
  one: (id: string) => ["enquiries", id] as const,
}

export const enquiriesQuery = () =>
  queryOptions({
    queryKey: enquiryKeys.list,
    queryFn: ({ signal }) =>
      apiFetch<{ counts: Record<Stage, number>; items: Enquiry[] }>(
        "/enquiries",
        { signal }
      ),
  })

export const enquiryQuery = (id: string) =>
  queryOptions({
    queryKey: enquiryKeys.one(id),
    queryFn: ({ signal }) => apiFetch<Enquiry>(`/enquiries/${id}`, { signal }),
  })

export const addEnquiry = (body: EnquiryInput) =>
  apiFetch<Enquiry>("/enquiries", { method: "POST", body })

export const updateEnquiry = (
  id: string,
  body: Partial<EnquiryInput> & {
    stage?: Stage
    lostReason?: string | null
    admittedStudentId?: string | null
  }
) => apiFetch<Enquiry>(`/enquiries/${id}`, { method: "PATCH", body })
