"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import {
  compact,
  SetupTable,
  text,
} from "~/features/academics/components/setup-table"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { useRoleLabel } from "~/features/shell/role-label"

import {
  allEmployeesQuery,
  departmentsApi,
  designationsApi,
  staffKeys,
  staffRolesQuery,
  type Department,
  type Designation,
} from "../api"

/** How many staff are in each department or designation. */
function useHeadcount(key: "departmentId" | "designationId") {
  const staff = useQuery(allEmployeesQuery())
  const counts = new Map<string, number>()
  for (const e of staff.data ?? []) {
    const id = e[key]
    if (id && e.status !== "terminated")
      counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** `/dashboard/staff/departments`. */
export function DepartmentsScreen() {
  const t = useTranslations("staffSetup.departments")
  const f = useSchoolFormat()
  const counts = useHeadcount("departmentId")
  return (
    <SetupTable<Department>
      queryKey={staffKeys.departments}
      invalidate={[staffKeys.all]}
      queryFn={departmentsApi.list}
      rowName={(r) => r.name}
      permissions={{
        create: "departments:create",
        update: "departments:update",
        delete: "departments:delete",
      }}
      emptyTitle={t("empty")}
      emptyBody={t("emptyBody")}
      columns={[
        {
          label: t("name"),
          cell: (r) => (
            <span className="flex items-center gap-2 font-medium">
              {r.name}
              {!r.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
            </span>
          ),
        },
        { label: t("code"), cell: (r) => r.code ?? "—" },
        {
          label: t("staff"),
          className: "text-right",
          cell: (r) => f.number(counts.get(r.id) ?? 0),
        },
      ]}
      fields={[
        { name: "name", label: t("name"), required: true, maxLength: 120 },
        { name: "code", label: t("code"), maxLength: 40 },
        {
          name: "description",
          label: t("description"),
          wide: true,
        },
        { name: "isActive", label: t("active"), type: "checkbox" },
      ]}
      emptyForm={{ name: "", code: "", description: "", isActive: true }}
      toForm={(r) => ({
        name: r.name,
        code: r.code ?? "",
        description: r.description ?? "",
        isActive: r.isActive,
      })}
      onCreate={(v) =>
        departmentsApi.create(
          compact({
            name: text(v, "name"),
            code: text(v, "code"),
            description: text(v, "description"),
            isActive: Boolean(v.isActive),
          })
        )
      }
      onUpdate={(r, v) =>
        departmentsApi.update(r.id, {
          name: text(v, "name"),
          code: text(v, "code"),
          description: text(v, "description"),
          isActive: Boolean(v.isActive),
        })
      }
      onDelete={(r) => departmentsApi.remove(r.id)}
    />
  )
}

/** `/dashboard/staff/designations`: job titles and the role they get. */
export function DesignationsScreen() {
  const t = useTranslations("staffSetup.designations")
  const f = useSchoolFormat()
  const roleLabel = useRoleLabel()
  const counts = useHeadcount("designationId")
  const roles = useQuery(staffRolesQuery())
  const roleName = (id: string | null) => {
    const role = roles.data?.find((r) => r.id === id)
    if (!role) return "—"
    return role.isSystem ? roleLabel(role.name) : role.name
  }
  return (
    <SetupTable<Designation>
      queryKey={staffKeys.designations}
      invalidate={[staffKeys.all]}
      queryFn={designationsApi.list}
      rowName={(r) => r.title}
      permissions={{
        create: "designations:create",
        update: "designations:update",
        delete: "designations:delete",
      }}
      emptyTitle={t("empty")}
      emptyBody={t("emptyBody")}
      columns={[
        {
          label: t("title"),
          cell: (r) => (
            <span className="flex items-center gap-2 font-medium">
              {r.title}
              {!r.isActive && <Badge variant="outline">{t("inactive")}</Badge>}
            </span>
          ),
        },
        { label: t("defaultRole"), cell: (r) => roleName(r.defaultRoleId) },
        {
          label: t("staff"),
          className: "text-right",
          cell: (r) => f.number(counts.get(r.id) ?? 0),
        },
      ]}
      fields={[
        { name: "title", label: t("title"), required: true, maxLength: 120 },
        {
          name: "defaultRoleId",
          label: t("defaultRole"),
          type: "select",
          hint: t("defaultRoleHint"),
          options: (roles.data ?? []).map((r) => ({
            value: r.id,
            label: roleName(r.id),
          })),
        },
        { name: "description", label: t("description"), wide: true },
        { name: "isActive", label: t("active"), type: "checkbox" },
      ]}
      emptyForm={{
        title: "",
        defaultRoleId: "",
        description: "",
        isActive: true,
      }}
      toForm={(r) => ({
        title: r.title,
        defaultRoleId: r.defaultRoleId ?? "",
        description: r.description ?? "",
        isActive: r.isActive,
      })}
      onCreate={(v) =>
        designationsApi.create(
          compact({
            title: text(v, "title"),
            defaultRoleId: text(v, "defaultRoleId"),
            description: text(v, "description"),
            isActive: Boolean(v.isActive),
          })
        )
      }
      onUpdate={(r, v) =>
        designationsApi.update(r.id, {
          title: text(v, "title"),
          defaultRoleId: text(v, "defaultRoleId"),
          description: text(v, "description"),
          isActive: Boolean(v.isActive),
        })
      }
      onDelete={(r) => designationsApi.remove(r.id)}
    />
  )
}
