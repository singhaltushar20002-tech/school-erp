"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRightIcon, LockIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { usePermissions } from "~/features/access/use-permissions"
import { allows } from "~/features/access/permissions"
import { classesQuery } from "~/features/academics/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  examKeys,
  examsQuery,
  gridQuery,
  saveMarks,
  sheetsQuery,
  submitSheet,
  type MarkEntry,
  type MarkGrid,
} from "../api"

/**
 * `/dashboard/exams/marks`: the mark sheets of open exams the user can
 * see (a subject teacher: their own), the unfinished ones first.
 */
export function MarkEntryList() {
  const t = useTranslations("exams.marks")
  const exams = useQuery(examsQuery())
  const open = (exams.data ?? []).filter((e) => e.status === "open")
  if (exams.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (!open.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noOpen")}</EmptyTitle>
          <EmptyDescription>{t("noOpenBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {open
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((e) => (
          <ExamSheets key={e.id} examId={e.id} name={e.name} />
        ))}
    </div>
  )
}

function ExamSheets({ examId, name }: { examId: string; name: string }) {
  const t = useTranslations("exams")
  const sheets = useQuery(sheetsQuery(examId))
  const classes = useQuery(classesQuery())
  if (sheets.isPending) return <Skeleton className="h-40 rounded-xl" />
  const level = (id: string) =>
    classes.data?.find((c) => c.id === id)?.level ?? 0
  const className = (id: string) =>
    classes.data?.find((c) => c.id === id)?.name ?? ""
  const list = (sheets.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        Number(a.status !== "draft") - Number(b.status !== "draft") ||
        level(a.classId) - level(b.classId) ||
        a.sectionName.localeCompare(b.sectionName) ||
        a.subjectName.localeCompare(b.subjectName)
    )
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold">{name}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("marks.noSheets")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {list.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/exams/marks/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{s.subjectName}</span>
                  <span className="text-sm text-muted-foreground">
                    {className(s.classId)} {s.sectionName}
                  </span>
                </span>
                <Badge variant={s.status === "draft" ? "outline" : "secondary"}>
                  {t(`overview.sheetStatus.${s.status}`)}
                </Badge>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const COMPONENTS = ["written", "practical", "oral", "cq", "mcq"] as const
const isComponent = (c: string): c is (typeof COMPONENTS)[number] =>
  (COMPONENTS as readonly string[]).includes(c)

type Draft = Record<string, Record<string, { value: string; absent: boolean }>>

const toDraft = (grid: MarkGrid): Draft =>
  Object.fromEntries(
    grid.students.map((s) => [
      s.enrollmentId,
      Object.fromEntries(
        grid.subject.components.map((c) => {
          const m = s.marks[c.id]
          return [
            c.id,
            {
              value: m?.value == null ? "" : String(m.value),
              absent: Boolean(m?.absent),
            },
          ]
        })
      ),
    ])
  )

/** `/dashboard/exams/marks/[sheetId]`: one subject's marks for a section. */
export function MarkSheetGrid({ sheetId }: { sheetId: string }) {
  const grid = useQuery(gridQuery(sheetId))
  if (grid.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (grid.isError) return null
  return <Grid key={grid.dataUpdatedAt} sheetId={sheetId} grid={grid.data} />
}

function Grid({ sheetId, grid }: { sheetId: string; grid: MarkGrid }) {
  const t = useTranslations("exams.marks")
  const tStatus = useTranslations("exams.overview.sheetStatus")
  const f = useSchoolFormat()
  const router = useRouter()
  const queryClient = useQueryClient()
  const canEnter = allows(usePermissions(), { permission: "results:enter" })
  const editable = grid.sheet.status === "draft" && canEnter
  const [draft, setDraft] = useState<Draft>(() => toDraft(grid))
  const comps = grid.subject.components
  const students = grid.students.filter((s) => s.active)

  const entries = (): MarkEntry[] =>
    students.flatMap((s) =>
      comps.flatMap((c): MarkEntry[] => {
        const d = draft[s.enrollmentId][c.id]
        if (d.absent)
          return [
            { enrollmentId: s.enrollmentId, componentId: c.id, absent: true },
          ]
        if (d.value === "") return []
        return [
          {
            enrollmentId: s.enrollmentId,
            componentId: c.id,
            value: Number(d.value),
          },
        ]
      })
    )
  const invalid = students.some((s) =>
    comps.some((c) => {
      const d = draft[s.enrollmentId][c.id]
      const n = Number(d.value)
      return (
        !d.absent && d.value !== "" && (isNaN(n) || n < 0 || n > c.fullMarks)
      )
    })
  )
  const missing = students.filter((s) =>
    comps.some((c) => {
      const d = draft[s.enrollmentId][c.id]
      return !d.absent && d.value === ""
    })
  ).length

  const done = async (message: string) => {
    toast.add({ title: message, type: "success" })
    await queryClient.invalidateQueries({ queryKey: examKeys.all })
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const save = useMutation({
    mutationFn: () => saveMarks(sheetId, entries()),
    onSuccess: () => done(t("saved")),
    onError: fail,
  })
  const submit = useMutation({
    mutationFn: async () => {
      await saveMarks(sheetId, entries())
      await submitSheet(sheetId)
    },
    onSuccess: async () => {
      await done(t("submitted"))
      router.push("/dashboard/exams/marks")
    },
    onError: fail,
  })
  const set = (
    eid: string,
    cid: string,
    patch: Partial<{ value: string; absent: boolean }>
  ) =>
    setDraft((d) => ({
      ...d,
      [eid]: { ...d[eid], [cid]: { ...d[eid][cid], ...patch } },
    }))

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-semibold">
          {grid.sheet.subjectName} · {grid.sheet.className}{" "}
          {grid.sheet.sectionName}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("sheetHint", {
            exam: grid.sheet.examName,
            full: comps.map((c) => f.number(c.fullMarks)).join(" + "),
          })}
        </p>
      </div>
      {!editable && (
        <Alert>
          <LockIcon />
          <AlertDescription>
            {t("locked", { status: tStatus(grid.sheet.status) })}
          </AlertDescription>
        </Alert>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-12 px-3 py-2 font-medium">{t("roll")}</th>
              <th className="px-3 py-2 font-medium">{t("student")}</th>
              {comps.map((c) => (
                <th key={c.id} className="px-3 py-2 font-medium">
                  {comps.length > 1
                    ? t("componentOf", {
                        name: isComponent(c.component)
                          ? t(`components.${c.component}`)
                          : c.component,
                        full: f.number(c.fullMarks),
                      })
                    : t("outOf", { full: f.number(c.fullMarks) })}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">{t("absent")}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const absent = comps.every(
                (c) => draft[s.enrollmentId][c.id].absent
              )
              return (
                <tr key={s.enrollmentId} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                    {s.rollNo ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                    {s.name}
                  </td>
                  {comps.map((c) => {
                    const d = draft[s.enrollmentId][c.id]
                    const n = Number(d.value)
                    const bad =
                      d.value !== "" && (isNaN(n) || n < 0 || n > c.fullMarks)
                    return (
                      <td key={c.id} className="px-3 py-1.5">
                        <Input
                          aria-label={t("markFor", { name: s.name })}
                          inputMode="decimal"
                          className={cn(
                            "h-9 w-20 tabular-nums",
                            bad && "border-destructive"
                          )}
                          disabled={!editable || d.absent}
                          value={d.absent ? "" : d.value}
                          aria-invalid={bad}
                          onChange={(e) =>
                            set(s.enrollmentId, c.id, {
                              value: e.target.value.replace(/[^\d.]/g, ""),
                            })
                          }
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      aria-label={t("absentFor", { name: s.name })}
                      className="size-4"
                      disabled={!editable}
                      checked={absent}
                      onChange={(e) =>
                        comps.forEach((c) =>
                          set(s.enrollmentId, c.id, {
                            absent: e.target.checked,
                          })
                        )
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:left-(--sidebar-width)">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <p
              className="flex-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {invalid
                ? t("tooHigh")
                : missing
                  ? t("missing", { count: missing, n: f.number(missing) })
                  : t("complete")}
            </p>
            <Button
              variant="outline"
              disabled={invalid || save.isPending || submit.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("save")}
            </Button>
            <Button
              disabled={invalid || missing > 0 || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? t("submitting") : t("submit")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
