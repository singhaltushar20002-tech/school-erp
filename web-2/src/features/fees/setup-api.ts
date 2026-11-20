import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "~/lib/api/client"

// Fee set-up (backend fees: fee-heads, fee-structures, discount-types,
// student-discounts, late-fine-rules). Money is in paise.

export type FeeFrequency = "monthly" | "quarterly" | "yearly" | "one_time"
export const FREQUENCIES: FeeFrequency[] = [
  "monthly",
  "quarterly",
  "yearly",
  "one_time",
]

export interface FeeHead {
  id: string
  name: string
  frequency: FeeFrequency
  isActive: boolean
  sortOrder: number
}

export interface FeeStructureItem {
  id?: string
  feeHeadId: string
  feeHead?: FeeHead
  amount: number
  dueDay?: number | null
  /** Calendar months billed (1–12); null = as the head's frequency. */
  months?: number[] | null
}

export interface FeeStructure {
  id: string
  name: string
  academicYearId: string
  classId: string
  schoolClass: { id: string; name: string; level: number | null }
  effectiveFrom: string | null
  items: FeeStructureItem[]
}

export type DiscountCode =
  "sibling" | "staff_child" | "rte" | "merit" | "custom"
export const DISCOUNT_CODES: DiscountCode[] = [
  "sibling",
  "staff_child",
  "rte",
  "merit",
  "custom",
]

export interface DiscountType {
  id: string
  name: string
  code: DiscountCode | "freedom_fighter"
  kind: "percent" | "fixed"
  /** Basis points for percent (1000 = 10%), paise for fixed. */
  value: number
  appliesToHeadIds: string[]
  isActive: boolean
}

export type ApprovalStatus = "pending" | "approved" | "rejected"

export interface StudentDiscount {
  id: string
  studentId: string
  student: { id: string; fullName: string; admissionNumber: string }
  discountTypeId: string
  discountType: DiscountType
  valueOverride: number | null
  fromPeriod: string
  toPeriod: string | null
  reason: string | null
  status: ApprovalStatus
  createdAt: string
}

export interface LateFineRule {
  id: string
  name: string
  feeHeadId: string | null
  kind: "fixed" | "per_day"
  amount: number
  graceDays: number | null
  maxAmount: number | null
  isActive: boolean
}

export const setupKeys = {
  all: ["fees", "setup"] as const,
  heads: ["fees", "setup", "heads"] as const,
  structures: (yearId: string) =>
    ["fees", "setup", "structures", yearId] as const,
  discountTypes: ["fees", "setup", "discount-types"] as const,
  studentDiscounts: (status: ApprovalStatus | "all") =>
    ["fees", "setup", "student-discounts", status] as const,
  fines: ["fees", "setup", "fines"] as const,
}

export const feeHeadsQuery = () =>
  queryOptions({
    queryKey: setupKeys.heads,
    queryFn: ({ signal }) => apiFetch<FeeHead[]>("/fee-heads", { signal }),
  })

export const feeStructuresQuery = (academicYearId: string) =>
  queryOptions({
    queryKey: setupKeys.structures(academicYearId),
    queryFn: ({ signal }) =>
      apiFetch<FeeStructure[]>("/fee-structures", {
        signal,
        query: { academicYearId },
      }),
  })

export const discountTypesQuery = () =>
  queryOptions({
    queryKey: setupKeys.discountTypes,
    queryFn: ({ signal }) =>
      apiFetch<DiscountType[]>("/discount-types", { signal }),
  })

export const studentDiscountsQuery = (status: ApprovalStatus | "all") =>
  queryOptions({
    queryKey: setupKeys.studentDiscounts(status),
    queryFn: ({ signal }) =>
      apiFetch<StudentDiscount[]>("/student-discounts", {
        signal,
        query: { status: status === "all" ? undefined : status },
      }),
  })

export const lateFinesQuery = () =>
  queryOptions({
    queryKey: setupKeys.fines,
    queryFn: ({ signal }) =>
      apiFetch<LateFineRule[]>("/late-fine-rules", { signal }),
  })

export const saveFeeHead = (
  body: Partial<Pick<FeeHead, "name" | "frequency" | "isActive">>,
  id?: string
) =>
  apiFetch<FeeHead>(id ? `/fee-heads/${id}` : "/fee-heads", {
    method: id ? "PATCH" : "POST",
    body,
  })

export interface StructureInput {
  name: string
  academicYearId: string
  classId: string
  items: {
    feeHeadId: string
    amount: number
    months?: number[] | null
  }[]
}

export const saveStructure = (body: StructureInput, id?: string) =>
  apiFetch<FeeStructure>(id ? `/fee-structures/${id}` : "/fee-structures", {
    method: id ? "PATCH" : "POST",
    body: id ? { name: body.name, items: body.items } : body,
  })

export interface DiscountTypeInput {
  name: string
  code: DiscountCode
  kind: "percent" | "fixed"
  value: number
  appliesToHeadIds: string[]
}

export const saveDiscountType = (
  body: Partial<DiscountTypeInput> & { isActive?: boolean },
  id?: string
) =>
  apiFetch<DiscountType>(id ? `/discount-types/${id}` : "/discount-types", {
    method: id ? "PATCH" : "POST",
    body,
  })

export const requestStudentDiscount = (body: {
  studentId: string
  discountTypeId: string
  fromPeriod: string
  toPeriod?: string
  reason?: string
}) => apiFetch<StudentDiscount>("/student-discounts", { method: "POST", body })

export const decideStudentDiscount = (
  id: string,
  decision: "approve" | "reject",
  note?: string
) =>
  apiFetch<StudentDiscount>(`/student-discounts/${id}/${decision}`, {
    method: "POST",
    body: note ? { note } : {},
  })

export interface FineInput {
  name: string
  kind: "fixed" | "per_day"
  amount: number
  graceDays?: number | null
  maxAmount?: number | null
  feeHeadId?: string | null
}

export const saveFineRule = (
  body: Partial<FineInput> & { isActive?: boolean },
  id?: string
) =>
  apiFetch<LateFineRule>(id ? `/late-fine-rules/${id}` : "/late-fine-rules", {
    method: id ? "PATCH" : "POST",
    body,
  })

/** `1000` basis points → `10`; a percent value as people type it. */
export const percentOf = (basisPoints: number) => basisPoints / 100
