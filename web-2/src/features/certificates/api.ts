import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { runExport } from "~/features/exports/export-button"
import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Certificates and ID cards (backend/src/modules/certificates).

export const CERTIFICATE_TYPES = [
  "tc",
  "character",
  "study",
  "testimonial",
] as const
export type CertificateType = (typeof CERTIFICATE_TYPES)[number]

export interface Certificate {
  id: string
  studentId: string
  type: CertificateType
  serial: string
  issuedAt: string
  status: "valid" | "revoked"
  revokeReason: string | null
  revokedAt: string | null
  data: {
    studentName: string
    admissionNumber: string
    className: string | null
    sectionName: string | null
    sessionName: string | null
    remarks: string | null
    conduct: string | null
    leavingReason: string | null
  }
}

export interface CertificateFilter {
  type: CertificateType | ""
  status: "valid" | "revoked" | ""
  page: number
}

export const CERTIFICATES_PAGE_SIZE = 25

export const certificateKeys = {
  all: ["certificates"] as const,
  list: (filter: CertificateFilter) => ["certificates", filter] as const,
}

export const certificatesQuery = (filter: CertificateFilter) =>
  queryOptions({
    queryKey: certificateKeys.list(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<Certificate>("/certificates", {
        signal,
        query: {
          type: filter.type || undefined,
          status: filter.status || undefined,
          page: filter.page,
          limit: CERTIFICATES_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const issueCertificate = (
  studentId: string,
  body: {
    type: CertificateType
    remarks?: string
    conduct?: string
    leavingReason?: string
  }
) =>
  apiFetch<Certificate>(`/students/${studentId}/certificates`, {
    method: "POST",
    body,
  })

export const revokeCertificate = (id: string, reason: string) =>
  apiFetch<Certificate>(`/certificates/${id}/revoke`, {
    method: "POST",
    body: { reason },
  })

/** Renders the certificate PDF and returns its download link. */
export const certificatePdf = (id: string) =>
  runExport(`/certificates/${id}/pdf`, {})

/** One PDF of ID cards for a section's active students. */
export const idCardsPdf = (sectionId: string) =>
  runExport(`/sections/${sectionId}/id-cards`, {})
