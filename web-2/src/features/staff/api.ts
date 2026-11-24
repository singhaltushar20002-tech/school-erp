import { queryOptions } from "@tanstack/react-query"

import { fetchAll } from "~/features/academics/api"
import { apiFetch, apiFetchPage } from "~/lib/api/client"

// Staff directory, departments and designations
// (backend/src/modules/employees, departments, designations).

export const EMPLOYEE_STATUSES = [
  "active",
  "on_leave",
  "inactive",
  "terminated",
] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export const EMPLOYMENT_TYPES = ["permanent", "contract", "part_time"] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const GENDERS = ["male", "female", "other"] as const

export interface Department {
  id: string
  name: string
  code: string | null
  description: string | null
  isActive: boolean
}

export interface Designation {
  id: string
  title: string
  description: string | null
  defaultRoleId: string | null
  isActive: boolean
}

export interface Employee {
  id: string
  employeeNumber: string | null
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  gender: (typeof GENDERS)[number] | null
  dob: string | null
  address: string | null
  joiningDate: string | null
  qualification: string | null
  status: EmployeeStatus
  employmentType: EmploymentType | null
  departmentId: string | null
  department: { id: string; name: string } | null
  designationId: string | null
  designation: { id: string; title: string } | null
  userId: string | null
}

export interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}

export const staffKeys = {
  all: ["staff"] as const,
  departments: ["staff", "departments"] as const,
  designations: ["staff", "designations"] as const,
  roles: ["staff", "roles"] as const,
  list: (filter: StaffFilter) => ["staff", "employees", filter] as const,
}

type Body = Record<string, unknown>

export const departmentsApi = {
  list: async (signal: AbortSignal) =>
    (await fetchAll<Department>("/departments", signal)).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
  create: (body: Body) =>
    apiFetch<Department>("/departments", { method: "POST", body }),
  update: (id: string, body: Body) =>
    apiFetch<Department>(`/departments/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    apiFetch<void>(`/departments/${id}`, { method: "DELETE" }),
}

export const designationsApi = {
  list: async (signal: AbortSignal) =>
    (await fetchAll<Designation>("/designations", signal)).sort((a, b) =>
      a.title.localeCompare(b.title)
    ),
  create: (body: Body) =>
    apiFetch<Designation>("/designations", { method: "POST", body }),
  update: (id: string, body: Body) =>
    apiFetch<Designation>(`/designations/${id}`, { method: "PATCH", body }),
  remove: (id: string) =>
    apiFetch<void>(`/designations/${id}`, { method: "DELETE" }),
}

export const departmentsQuery = () =>
  queryOptions({
    queryKey: staffKeys.departments,
    queryFn: ({ signal }) => departmentsApi.list(signal),
  })

export const designationsQuery = () =>
  queryOptions({
    queryKey: staffKeys.designations,
    queryFn: ({ signal }) => designationsApi.list(signal),
  })

/** Staff roles only: portal roles (guardian, student) can't be given. */
export const staffRolesQuery = () =>
  queryOptions({
    queryKey: staffKeys.roles,
    queryFn: async ({ signal }) =>
      (await apiFetch<Role[]>("/roles", { signal }))
        .filter((r) => !r.permissions.some((p) => p.startsWith("portal:")))
        .sort((a, b) => a.name.localeCompare(b.name)),
  })

export interface StaffFilter {
  status?: EmployeeStatus
  departmentId?: string
  designationId?: string
  page: number
}

export const STAFF_PAGE_SIZE = 25

export const employeesQuery = (filter: StaffFilter) =>
  queryOptions({
    queryKey: staffKeys.list(filter),
    queryFn: ({ signal }) =>
      apiFetchPage<Employee>("/employees", {
        signal,
        query: { ...filter, limit: STAFF_PAGE_SIZE },
      }),
    placeholderData: (old) => old,
  })

/** Every staff member (for searching across pages on the client). */
export const allEmployeesQuery = () =>
  queryOptions({
    queryKey: [...staffKeys.all, "employees", "all"] as const,
    queryFn: async ({ signal }) =>
      (await fetchAll<Employee>("/employees", signal)).sort((a, b) =>
        a.fullName.localeCompare(b.fullName)
      ),
  })

export const createEmployee = (body: Body) =>
  apiFetch<Employee>("/employees", { method: "POST", body })

export const updateEmployee = (id: string, body: Body) =>
  apiFetch<Employee>(`/employees/${id}`, { method: "PATCH", body })

/** Soft-deleted: attendance, payroll and teaching history stay. */
export const deleteEmployee = (id: string) =>
  apiFetch<void>(`/employees/${id}`, { method: "DELETE" })

export type InviteResult =
  | { userId: string; delivery: "email" }
  | { userId: string; delivery: "slip"; temporaryPassword: string }
  | { userId: string; delivery: "existing_account" }

/** A sign-in for the staff member with these roles. */
export const inviteEmployee = (id: string, roleIds: string[]) =>
  apiFetch<InviteResult>(`/employees/${id}/invite`, {
    method: "POST",
    body: roleIds.length ? { roleIds } : {},
  })
