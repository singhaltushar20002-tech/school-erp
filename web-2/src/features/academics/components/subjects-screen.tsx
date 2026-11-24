"use client"

import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"

import {
  SUBJECT_TYPES,
  setupKeys,
  subjectGroupsApi,
  subjectsApi,
  type Subject,
  type SubjectGroup,
} from "../api"
import { compact, num, SetupTable, text } from "./setup-table"

const byName = <T extends { name: string }>(rows: T[]) =>
  rows.sort((a, b) => a.name.localeCompare(b.name))

/**
 * `/dashboard/academics/subjects`: the school's subject list (what classes
 * pick from on the curriculum screen) and the streams that group them.
 */
export function SubjectsScreen() {
  const t = useTranslations("academicSetup.subjects")

  return (
    <div className="flex flex-col gap-8">
      <SetupTable<Subject>
        title={t("title")}
        description={t("hint")}
        queryKey={setupKeys.subjects}
        queryFn={async (signal) => byName(await subjectsApi.list(signal))}
        rowName={(r) => r.name}
        permissions={{
          create: "subjects:create",
          update: "subjects:update",
          delete: "subjects:delete",
        }}
        emptyTitle={t("empty")}
        columns={[
          {
            label: t("name"),
            cell: (r) => (
              <span className="flex items-center gap-2 font-medium">
                {r.name}
                {!r.isActive && (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
              </span>
            ),
          },
          {
            label: t("code"),
            cell: (r) => <span className="font-mono">{r.code ?? "—"}</span>,
          },
          { label: t("type"), cell: (r) => t(`types.${r.type}`) },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 120 },
          {
            name: "code",
            label: t("code"),
            maxLength: 40,
            hint: t("codeHint"),
          },
          {
            name: "type",
            label: t("type"),
            type: "select",
            required: true,
            options: SUBJECT_TYPES.map((s) => ({
              value: s,
              label: t(`types.${s}`),
            })),
          },
          { name: "credit", label: t("credit"), type: "number" },
          { name: "isActive", label: t("active"), type: "checkbox" },
        ]}
        emptyForm={{
          name: "",
          code: "",
          type: "theory",
          credit: "",
          isActive: true,
        }}
        toForm={(r) => ({
          name: r.name,
          code: r.code ?? "",
          type: r.type,
          credit: r.credit == null ? "" : String(r.credit),
          isActive: r.isActive,
        })}
        onCreate={(v) =>
          subjectsApi.create(
            compact({
              name: text(v, "name"),
              code: text(v, "code"),
              type: text(v, "type"),
              credit: num(v, "credit"),
              isActive: Boolean(v.isActive),
            })
          )
        }
        onUpdate={(r, v) =>
          subjectsApi.update(r.id, {
            name: text(v, "name"),
            code: text(v, "code"),
            type: text(v, "type"),
            credit: num(v, "credit"),
            isActive: Boolean(v.isActive),
          })
        }
        onDelete={(r) => subjectsApi.remove(r.id)}
      />

      <SetupTable<SubjectGroup>
        title={t("groups")}
        description={t("groupsHint")}
        queryKey={setupKeys.subjectGroups}
        queryFn={async (signal) => byName(await subjectGroupsApi.list(signal))}
        rowName={(r) => r.name}
        permissions={{
          create: "subject_groups:create",
          update: "subject_groups:update",
          delete: "subject_groups:delete",
        }}
        emptyTitle={t("groupsEmpty")}
        columns={[
          {
            label: t("name"),
            cell: (r) => <span className="font-medium">{r.name}</span>,
          },
          { label: t("code"), cell: (r) => r.code ?? "—" },
        ]}
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 120 },
          { name: "code", label: t("code"), maxLength: 40 },
        ]}
        emptyForm={{ name: "", code: "" }}
        toForm={(r) => ({ name: r.name, code: r.code ?? "" })}
        onCreate={(v) =>
          subjectGroupsApi.create(
            compact({ name: text(v, "name"), code: text(v, "code") })
          )
        }
        onUpdate={(r, v) =>
          subjectGroupsApi.update(r.id, {
            name: text(v, "name"),
            code: text(v, "code"),
          })
        }
        onDelete={(r) => subjectGroupsApi.remove(r.id)}
      />
    </div>
  )
}
