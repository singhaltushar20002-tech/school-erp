"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { useSchoolFormat } from "~/features/settings/use-school-format"

import {
  academicKeys,
  CLASS_SUBJECT_TYPES,
  classesApi,
  curriculumApi,
  setupKeys,
  subjectGroupsApi,
  subjectsApi,
  type CurriculumRow,
} from "../api"
import { SessionSelect, useSessions } from "./session-picker"
import { compact, num, SetupTable, text } from "./setup-table"

/**
 * `/dashboard/academics/curriculum`: what a class studies in a session,
 * with periods a week and pass/full marks (exams copy these).
 */
export function CurriculumScreen() {
  const t = useTranslations("academicSetup.curriculum")
  const f = useSchoolFormat()
  const { sessions, sessionId, setSessionId, isPending } = useSessions()
  const classes = useQuery({
    queryKey: academicKeys.classes,
    queryFn: ({ signal }) => classesApi.list(signal),
  })
  const subjects = useQuery({
    queryKey: setupKeys.subjects,
    queryFn: ({ signal }) => subjectsApi.list(signal),
  })
  const groups = useQuery({
    queryKey: setupKeys.subjectGroups,
    queryFn: ({ signal }) => subjectGroupsApi.list(signal),
  })
  const [picked, setPicked] = useState("")
  const classId = picked || classes.data?.[0]?.id || ""
  const chosen = classes.data?.find((c) => c.id === classId)
  const offered = useQuery({
    queryKey: setupKeys.curriculum(sessionId, classId),
    queryFn: ({ signal }) => curriculumApi.list(sessionId, classId, signal),
    enabled: Boolean(sessionId && classId),
  })
  const taken = new Set((offered.data ?? []).map((r) => r.subjectId))
  const weekly = (offered.data ?? []).reduce(
    (n, r) => n + (r.weeklyClasses ?? 0),
    0
  )

  return (
    <SetupTable<CurriculumRow>
      title={chosen ? t("titleFor", { name: chosen.name }) : t("title")}
      description={
        weekly > 0 ? t("weeklyTotal", { n: f.number(weekly) }) : t("hint")
      }
      toolbar={
        <>
          <NativeSelect
            aria-label={t("class")}
            value={classId}
            onChange={(e) => setPicked(e.target.value)}
          >
            {(classes.data ?? []).map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {sessions.length > 0 && (
            <SessionSelect
              sessions={sessions}
              value={sessionId}
              onChange={setSessionId}
            />
          )}
        </>
      }
      enabled={Boolean(sessionId && classId)}
      waiting={isPending || classes.isPending}
      queryKey={setupKeys.curriculum(sessionId, classId)}
      invalidate={[academicKeys.classSubjects(sessionId)]}
      queryFn={(signal) => curriculumApi.list(sessionId, classId, signal)}
      rowName={(r) => r.subject.name}
      permissions={{
        create: "class_subjects:create",
        update: "class_subjects:update",
        delete: "class_subjects:delete",
      }}
      emptyTitle={t("empty")}
      emptyBody={t("emptyBody")}
      columns={[
        {
          label: t("subject"),
          cell: (r) => (
            <span className="flex flex-col">
              <span className="font-medium">{r.subject.name}</span>
              {r.subject.code && (
                <span className="font-mono text-xs text-muted-foreground">
                  {r.subject.code}
                </span>
              )}
            </span>
          ),
        },
        {
          label: t("kind"),
          cell: (r) => (
            <span className="flex flex-wrap gap-1">
              <Badge
                variant={
                  r.subjectType === "compulsory" ? "secondary" : "outline"
                }
              >
                {t(`types.${r.subjectType}`)}
              </Badge>
              {r.subjectGroup && (
                <Badge variant="outline">{r.subjectGroup.name}</Badge>
              )}
            </span>
          ),
        },
        {
          label: t("weekly"),
          className: "text-right",
          cell: (r) =>
            r.weeklyClasses == null ? "—" : f.number(r.weeklyClasses),
        },
        {
          label: t("marks"),
          className: "hidden text-right md:table-cell",
          cell: (r) =>
            r.fullMarks == null
              ? "—"
              : t("passOfFull", {
                  pass: r.passMarks == null ? "—" : f.number(r.passMarks),
                  full: f.number(r.fullMarks),
                }),
        },
      ]}
      fields={[
        {
          name: "subjectId",
          label: t("subject"),
          type: "select",
          required: true,
          createOnly: true,
          wide: true,
          options: (subjects.data ?? [])
            .filter((s) => s.isActive && !taken.has(s.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({
              value: s.id,
              label: s.code ? `${s.name} (${s.code})` : s.name,
            })),
        },
        {
          name: "subjectType",
          label: t("kind"),
          type: "select",
          required: true,
          hint: t("kindHint"),
          options: CLASS_SUBJECT_TYPES.map((s) => ({
            value: s,
            label: t(`types.${s}`),
          })),
        },
        {
          name: "subjectGroupId",
          label: t("group"),
          type: "select",
          hint: t("groupHint"),
          options: (groups.data ?? []).map((g) => ({
            value: g.id,
            label: g.name,
          })),
        },
        { name: "weeklyClasses", label: t("weekly"), type: "number" },
        { name: "fullMarks", label: t("fullMarks"), type: "number" },
        { name: "passMarks", label: t("passMarks"), type: "number" },
      ]}
      emptyForm={{
        subjectId: "",
        subjectType: "compulsory",
        subjectGroupId: "",
        weeklyClasses: "",
        fullMarks: "100",
        passMarks: "33",
      }}
      toForm={(r) => ({
        subjectId: r.subjectId,
        subjectType: r.subjectType,
        subjectGroupId: r.subjectGroupId ?? "",
        weeklyClasses: r.weeklyClasses == null ? "" : String(r.weeklyClasses),
        fullMarks: r.fullMarks == null ? "" : String(r.fullMarks),
        passMarks: r.passMarks == null ? "" : String(r.passMarks),
      })}
      onCreate={(v) =>
        curriculumApi.create(
          compact({
            academicYearId: sessionId,
            classId,
            subjectId: text(v, "subjectId"),
            subjectType: text(v, "subjectType"),
            subjectGroupId: text(v, "subjectGroupId"),
            weeklyClasses: num(v, "weeklyClasses"),
            fullMarks: num(v, "fullMarks"),
            passMarks: num(v, "passMarks"),
          })
        )
      }
      onUpdate={(r, v) =>
        curriculumApi.update(r.id, {
          ...compact({
            subjectType: text(v, "subjectType"),
            weeklyClasses: num(v, "weeklyClasses"),
            fullMarks: num(v, "fullMarks"),
            passMarks: num(v, "passMarks"),
          }),
          subjectGroupId: text(v, "subjectGroupId"),
        })
      }
      onDelete={(r) => curriculumApi.remove(r.id)}
    />
  )
}
