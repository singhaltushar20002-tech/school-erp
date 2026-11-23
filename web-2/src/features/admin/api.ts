import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Users & access (backend/src/modules/users, rbac, audit).

export type MemberStatus = "pending" | "active" | "suspended" | "deactivated"

export interface Member {
  id: string
  membershipId: string
  email: string | null
  phone: string | null
  name: string
  status: MemberStatus
  isAdmin: boolean
  roles: { id: string; name: string }[]
  createdAt: string
}

export interface RoleRow {
  id: string
  name: string
  description: string | null
  permissions: string[]
  scope: "school" | "assigned"
  isSystem: boolean
}

export interface PermissionGroup {
  resource: string
  permissions: { key: string; action: string }[]
}

export interface AuditEntry {
  id: string
  actorUserId: string | null
  actorType: string
  action: string
  entityType: string | null
  entityId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: string
}

export interface AuditFilter {
  action: string
  entityType: string
  actorUserId: string
  from: string
  to: string
  page: number
}

export const AUDIT_PAGE_SIZE = 50

export const adminKeys = {
  members: ["admin", "members"] as const,
  roles: ["admin", "roles"] as const,
  permissions: ["admin", "permissions"] as const,
  audit: (filter: AuditFilter) => ["admin", "audit", filter] as const,
}

/** Everyone with a membership here, staff and parents (one list). */
export const membersQuery = () =>
  queryOptions({
    queryKey: adminKeys.members,
    queryFn: async ({ signal }) =>
      (await apiFetch<Member[]>("/users", { signal })).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
  })

export const rolesQuery = () =>
  queryOptions({
    queryKey: adminKeys.roles,
    queryFn: ({ signal }) => apiFetch<RoleRow[]>("/roles", { signal }),
  })

export const permissionsQuery = () =>
  queryOptions({
    queryKey: adminKeys.permissions,
    queryFn: ({ signal }) =>
      apiFetch<PermissionGroup[]>("/permissions", { signal }),
    staleTime: Infinity,
  })

export const auditQuery = (filter: AuditFilter) =>
  queryOptions({
    queryKey: adminKeys.audit(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<AuditEntry>("/audit-logs", {
        signal,
        query: {
          action: filter.action || undefined,
          entityType: filter.entityType || undefined,
          actorUserId: filter.actorUserId || undefined,
          from: filter.from || undefined,
          to: filter.to || undefined,
          page: filter.page,
          limit: AUDIT_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

/** Suspending signs them out everywhere in this school. */
export const setMemberStatus = (id: string, status: MemberStatus) =>
  apiFetch<Member>(`/users/${id}`, { method: "PATCH", body: { status } })

export const removeMember = (id: string) =>
  apiFetch<void>(`/users/${id}`, { method: "DELETE" })

export const grantAdmin = (id: string) =>
  apiFetch<unknown>(`/users/${id}/grant-admin`, { method: "POST", body: {} })

export const revokeAdmin = (id: string) =>
  apiFetch<unknown>(`/users/${id}/revoke-admin`, { method: "POST", body: {} })

export const assignRole = (userId: string, roleId: string) =>
  apiFetch<unknown>(`/users/${userId}/roles`, {
    method: "POST",
    body: { roleId },
  })

export const unassignRole = (userId: string, roleId: string) =>
  apiFetch<unknown>(`/users/${userId}/roles/${roleId}`, { method: "DELETE" })

export const createRole = (body: {
  name: string
  description?: string
  permissions: string[]
  scope: RoleRow["scope"]
}) => apiFetch<RoleRow>("/roles", { method: "POST", body })

export const cloneRole = (id: string, name: string) =>
  apiFetch<RoleRow>(`/roles/${id}/clone`, { method: "POST", body: { name } })

export const updateRole = (
  id: string,
  body: { name?: string; description?: string | null }
) => apiFetch<RoleRow>(`/roles/${id}`, { method: "PATCH", body })

export const setRolePermissions = (id: string, permissions: string[]) =>
  apiFetch<RoleRow>(`/roles/${id}/permissions`, {
    method: "PUT",
    body: { permissions },
  })

export const deleteRole = (id: string) =>
  apiFetch<void>(`/roles/${id}`, { method: "DELETE" })

/** Portal roles (parents, students) hold only `portal:*` keys. */
export const isPortalRole = (role: { permissions: string[] }) =>
  role.permissions.length > 0 &&
  role.permissions.every((p) => p.startsWith("portal:"))
