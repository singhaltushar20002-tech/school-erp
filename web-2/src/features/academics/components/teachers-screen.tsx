"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserRoundXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { toast } from "~/components/ui/toast"
import { usePermissions } from "~/features/access/use-permissions"
import { allows } from "~/features/access/permissions"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  academicKeys,
  assignClassTeacher,
  assignSubjectTeacher,
  changeClassTeacher,
  changeSubjectTeacher,
  classesApi,
  classTeachersQuery,
  curriculumApi,
  endClassTeacher,
  endSubjectTeacher,
  sectionsQuery,
  setupKeys,
  subjectTeachersQuery,
  teachersQuery,
  type Teacher,
} from "../api"
import { SessionSelect, useSessions } from "./session-picker"

/**
 * `/dashboard/academics/teachers`: who is class teacher of a section and
 * who teaches each of its subjects. Changes hand over from today, so
 * attendance and marks history keep the earlier teacher.
 */
export function TeachersScreen() {
  const t = useTranslations("academicSetup.teachers")
  const permissions = usePermissions()
  const { sessions, sessionId, setSessionId } = useSessions()
  const classes = useQuery({
    queryKey: academicKeys.classes,
    queryFn: ({ signal }) => classesApi.list(signal),
  })
  const sections = useQuery({
    ...sectionsQuery(sessionId),
    enabled: Boolean(sessionId),
  })
  const order = new Map((classes.data ?? []).map((c, i) => [c.id, i]))
  const className = new Map((classes.data ?? []).map((c) => [c.id, c.name]))
  const options = (sections.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        (order.get(a.classId) ?? 0) - (order.get(b.classId) ?? 0) ||
        a.name.localeCompare(b.name)
    )
  const [picked, setPicked] = useState("")
  const section = options.find((s) => s.id === picked) ?? options[0]
  const sectionId = section?.id ?? ""

  const teachers = useQuery(teachersQuery())
  const classTeachers = useQuery(classTeachersQuery(sectionId))
  const subjectTeachers = useQuery(subjectTeachersQuery(sectionId))
  const curriculum = useQuery({
    queryKey: setupKeys.curriculum(sessionId, section?.classId ?? ""),
    queryFn: ({ signal }) =>
      curriculumApi.list(sessionId, section!.classId, signal),
    enabled: Boolean(section),
  })

  const canClass = allows(permissions, {
    permission: ["class_teachers:create", "class_teachers:update"],
  })
  const canSubject = allows(permissions, {
    permission: ["subject_teachers:create", "subject_teachers:update"],
  })
  const primary =
    classTeachers.data?.find((c) => c.isPrimary) ?? classTeachers.data?.[0]
  const bySubject = new Map(
    (subjectTeachers.data ?? []).map((s) => [s.classSubjectId, s])
  )
  const assigned = (curriculum.data ?? []).filter((c) =>
    bySubject.has(c.id)
  ).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("section")}
          value={sectionId}
          onChange={(e) => setPicked(e.target.value)}
        >
          {options.map((s) => (
            <NativeSelectOption key={s.id} value={s.id}>
              {className.get(s.classId)} {s.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {sessions.length > 0 && (
          <SessionSelect
            sessions={sessions}
            value={sessionId}
            onChange={(id) => {
              setSessionId(id)
              setPicked("")
            }}
          />
        )}
      </div>

      {sections.isPending || classes.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : !section ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("noSections")}</EmptyTitle>
            <EmptyDescription>{t("noSectionsBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{t("classTeacher")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("classTeacherHint")}
            </p>
            {classTeachers.isPending ? (
              <Skeleton className="h-9 w-72" />
            ) : (
              <TeacherPicker
                label={t("classTeacher")}
                teachers={teachers.data ?? []}
                current={primary?.employeeId}
                disabled={!canClass}
                onPick={(employeeId) =>
                  primary
                    ? changeClassTeacher(primary.id, { employeeId })
                    : assignClassTeacher({
                        sectionId,
                        employeeId,
                        isPrimary: true,
                      })
                }
                onClear={
                  primary ? () => endClassTeacher(primary.id) : undefined
                }
                refresh={setupKeys.classTeachers(sectionId)}
                since={primary?.effectiveFrom}
              />
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-2">
              <div className="me-auto">
                <h2 className="text-lg font-semibold">
                  {t("subjectTeachers")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("assignedCount", {
                    n: assigned,
                    total: curriculum.data?.length ?? 0,
                  })}
                </p>
              </div>
            </div>
            {curriculum.isPending || subjectTeachers.isPending ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (curriculum.data ?? []).length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>{t("noSubjects")}</EmptyTitle>
                  <EmptyDescription>{t("noSubjectsBody")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("subject")}</TableHead>
                      <TableHead>{t("teacher")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(curriculum.data ?? []).map((cs) => {
                      const row = bySubject.get(cs.id)
                      return (
                        <TableRow key={cs.id}>
                          <TableCell className="font-medium">
                            {cs.subject.name}
                            {cs.subjectType !== "compulsory" && (
                              <Badge variant="outline" className="ms-2">
                                {t(`types.${cs.subjectType}`)}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <TeacherPicker
                              label={t("teacherFor", {
                                subject: cs.subject.name,
                              })}
                              teachers={teachers.data ?? []}
                              current={row?.employeeId}
                              disabled={!canSubject}
                              onPick={(employeeId) =>
                                row
                                  ? changeSubjectTeacher(row.id, employeeId)
                                  : assignSubjectTeacher({
                                      sectionId,
                                      classSubjectId: cs.id,
                                      employeeId,
                                    })
                              }
                              onClear={
                                row
                                  ? () => endSubjectTeacher(row.id)
                                  : undefined
                              }
                              refresh={setupKeys.subjectTeachers(sectionId)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** A teacher dropdown that saves as soon as a teacher is picked. */
function TeacherPicker({
  label,
  teachers,
  current,
  disabled,
  onPick,
  onClear,
  refresh,
  since,
}: {
  label: string
  teachers: Teacher[]
  current?: string
  disabled: boolean
  onPick: (employeeId: string) => Promise<unknown>
  onClear?: () => Promise<unknown>
  refresh: readonly unknown[]
  since?: string
}) {
  const t = useTranslations("academicSetup.teachers")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const done = async (message: string) => {
    toast.add({ title: message, type: "success" })
    await queryClient.invalidateQueries({ queryKey: refresh })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const pick = useMutation({
    mutationFn: onPick,
    onSuccess: () => done(t("saved")),
    onError: fail,
  })
  const clear = useMutation({
    mutationFn: () => onClear!(),
    onSuccess: () => done(t("cleared")),
    onError: fail,
  })
  const busy = pick.isPending || clear.isPending
  // A teacher who left still shows on rows that name them.
  const known = teachers.some((x) => x.id === current)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label={label}
        className="min-w-56"
        value={current ?? ""}
        disabled={disabled || busy}
        onChange={(e) => e.target.value && pick.mutate(e.target.value)}
      >
        <NativeSelectOption value="">{t("unassigned")}</NativeSelectOption>
        {current && !known && (
          <NativeSelectOption value={current}>{t("former")}</NativeSelectOption>
        )}
        {teachers.map((x) => (
          <NativeSelectOption key={x.id} value={x.id}>
            {x.fullName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {onClear && !disabled && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("clear")}
          disabled={busy}
          onClick={() => clear.mutate()}
        >
          <UserRoundXIcon />
        </Button>
      )}
      {since && (
        <span className="text-xs text-muted-foreground">
          {t("since", { date: f.date(since) })}
        </span>
      )}
    </div>
  )
}
