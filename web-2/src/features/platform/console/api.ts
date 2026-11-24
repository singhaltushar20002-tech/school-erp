import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// The platform console (admin host): schools, plans, platform staff and
// the platform audit log. Calls go through the BFF with the platform
// session (backend: organizations, plans, users, audit modules).

export const SCHOOL_STATUSES = [
  "trial",
  "active",
  "past_due",
  "inactive",
  "suspended",
  "pending",
] as const
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number]

export const SCHOOL_TYPES = [
  "school",
  "college",
  "coaching",
  "english_medium",
  "madrasa",
] as const
export type SchoolType = (typeof SCHOOL_TYPES)[number]

export const PLAN_CODES = ["free", "basic", "standard", "premium"] as const
export type PlanCode = (typeof PLAN_CODES)[number]

export interface SchoolRow {
  id: string
  name: string
  slug: string
  status: SchoolStatus
  type: SchoolType
  plan: { code: PlanCode; name: string } | null
  addOnModules: string[]
  limitOverrides: Limits | null
  trialEndsAt: string | null
  onboardingCompletedAt: string | null
  district: string | null
  activeStudentCount: number
  createdAt: string
}

export interface Limits {
  students: number | null
  storageMb: number | null
  users: number | null
  admins: number | null
}

export interface Plan {
  id: string
  code: PlanCode
  name: string
  /** Minor units per student per month. */
  pricePerStudent: number
  /** Minor units per month. */
  minFee: number
  currency: string
  modules: string[]
  limits: Limits
  isActive: boolean
  sortOrder: number
}

export interface PlanCatalog {
  plans: Plan[]
  modules: string[]
  addOnModules: string[]
}

export interface Membership {
  id: string
  userId: string
  orgId: string
  role: "owner" | "member" | string
  isAdmin: boolean
  status: string
}

export const PLATFORM_ROLES = [
  "super_admin",
  "admin",
  "support",
  "developer",
] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export interface PlatformUser {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  platformRole: PlatformRole | "user"
  status: "pending" | "active" | "suspended" | "deactivated" | "banned"
  emailVerifiedAt: string | null
  passwordSet: boolean
  mustChangePassword: boolean
  createdAt: string
}

export interface AuditEntry {
  id: string
  orgId: string | null
  actorUserId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface SchoolFilter {
  q: string
  status: SchoolStatus | ""
  plan: PlanCode | ""
  page: number
}

export interface AuditFilter {
  orgId: string
  action: string
  from: string
  to: string
  page: number
}

export const SCHOOLS_PAGE_SIZE = 25
export const AUDIT_PAGE_SIZE = 50

export const consoleKeys = {
  all: ["console"] as const,
  schools: (filter: SchoolFilter) => ["console", "schools", filter] as const,
  allSchools: ["console", "schools", "all"] as const,
  school: (id: string) => ["console", "school", id] as const,
  members: (id: string) => ["console", "school", id, "members"] as const,
  plans: ["console", "plans"] as const,
  staff: ["console", "staff"] as const,
  user: (id: string) => ["console", "user", id] as const,
  audit: (filter: AuditFilter) => ["console", "audit", filter] as const,
}

export const schoolsQuery = (filter: SchoolFilter) =>
  queryOptions({
    queryKey: consoleKeys.schools(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<SchoolRow>("/organizations", {
        signal,
        query: {
          q: filter.q || undefined,
          status: filter.status || undefined,
          plan: filter.plan || undefined,
          page: filter.page,
          limit: SCHOOLS_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

/** Every school (for the overview's totals and the audit filter). */
export const allSchoolsQuery = () =>
  queryOptions({
    queryKey: consoleKeys.allSchools,
    queryFn: async ({ signal }) => {
      const items: SchoolRow[] = []
      for (let page = 1; ; page++) {
        const result = await apiFetchPage<SchoolRow>("/organizations", {
          signal,
          query: { page, limit: 100 },
        })
        items.push(...result.items)
        if (page >= result.meta.totalPages) return items
      }
    },
  })

/** One school, with its list row (plan name, student count). */
export const schoolQuery = (id: string) =>
  queryOptions({
    queryKey: consoleKeys.school(id),
    queryFn: async ({ signal }) => {
      const detail = await apiFetch<{ slug: string; eiin: string | null }>(
        `/organizations/${id}`,
        { signal }
      )
      const page = await apiFetchPage<SchoolRow>("/organizations", {
        signal,
        query: { q: detail.slug, page: 1, limit: 100 },
      })
      const row = page.items.find((s) => s.id === id)
      if (!row) throw new Error("School not found")
      return { ...row, eiin: detail.eiin }
    },
  })

export const membersQuery = (orgId: string) =>
  queryOptions({
    queryKey: consoleKeys.members(orgId),
    queryFn: ({ signal }) =>
      apiFetch<Membership[]>(`/memberships/organization/${orgId}`, { signal }),
  })

export const platformUserQuery = (id: string) =>
  queryOptions({
    queryKey: consoleKeys.user(id),
    queryFn: ({ signal }) =>
      apiFetch<PlatformUser>(`/platform/users/${id}`, { signal }),
    enabled: Boolean(id),
  })

export const plansQuery = () =>
  queryOptions({
    queryKey: consoleKeys.plans,
    queryFn: ({ signal }) =>
      apiFetch<PlanCatalog>("/platform/plans", { signal }),
    staleTime: 5 * 60_000,
  })

/** The platform team: everyone with a console role. */
export const staffQuery = () =>
  queryOptions({
    queryKey: consoleKeys.staff,
    queryFn: async ({ signal }) =>
      (
        await Promise.all(
          PLATFORM_ROLES.map((platformRole) =>
            apiFetch<PlatformUser[]>("/platform/users", {
              signal,
              query: { platformRole },
            })
          )
        )
      )
        .flat()
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
  })

export const auditQuery = (filter: AuditFilter) =>
  queryOptions({
    queryKey: consoleKeys.audit(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<AuditEntry>("/platform/audit-logs", {
        signal,
        query: {
          orgId: filter.orgId || undefined,
          action: filter.action || undefined,
          from: filter.from || undefined,
          to: filter.to || undefined,
          page: filter.page,
          limit: AUDIT_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const createSchool = (body: {
  name: string
  slug: string
  type: SchoolType
  planCode: PlanCode
  trialDays?: number
  ownerName?: string
  ownerEmail?: string
}) =>
  apiFetch<{ id: string; slug: string }>("/organizations", {
    method: "POST",
    body,
  })

export const updateSchool = (
  id: string,
  body: { name?: string; type?: SchoolType; status?: SchoolStatus }
) => apiFetch<unknown>(`/organizations/${id}`, { method: "PATCH", body })

export const changePlan = (
  id: string,
  body: { planCode: PlanCode; addOnModules: string[] }
) => apiFetch<unknown>(`/organizations/${id}/plan`, { method: "PATCH", body })

export const extendTrial = (id: string, days: number) =>
  apiFetch<unknown>(`/organizations/${id}/trial/extend`, {
    method: "POST",
    body: { days },
  })

export const setLimits = (id: string, body: Limits) =>
  apiFetch<unknown>(`/organizations/${id}/limits`, { method: "PUT", body })

/** Emails the owner a new link; managers also get the token back. */
export const resendOwnerLink = (id: string) =>
  apiFetch<{ orgSlug: string; token?: string }>(
    `/organizations/${id}/owner/activation-link`,
    { method: "POST", body: {} }
  )

export const createStaff = (body: {
  name: string
  email: string
  password: string
  platformRole: PlatformRole
}) => apiFetch<PlatformUser>("/platform/users", { method: "POST", body })

export const updateStaff = (
  id: string,
  body: {
    platformRole?: PlatformRole | "user"
    status?: PlatformUser["status"]
  }
) => apiFetch<PlatformUser>(`/platform/users/${id}`, { method: "PATCH", body })

export const removeStaff = (id: string) =>
  apiFetch<void>(`/platform/users/${id}`, { method: "DELETE" })
