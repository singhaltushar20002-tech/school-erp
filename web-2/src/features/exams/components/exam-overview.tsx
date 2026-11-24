"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCheckIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Empty, EmptyHeader, EmptyTitle } from "~/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Progress } from "~/components/ui/progress"
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
import { Can } from "~/features/access/can"
import {
  classesQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { WidgetCard } from "~/features/dashboard/components/widget-group"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  approveSheets,
  definitionsQuery,
  examKeys,
  examsQuery,
  printReportCards,
  publishResults,
  sheetsQuery,
  type ResultDefinition,
  type SheetRow,
} from "../api"

type Filter = "pending" | "submitted" | "approved"

const groupOf = (s: SheetRow): Filter =>
  s.status === "draft"
    ? "pending"
    : s.status === "submitted" || s.status === "verified"
      ? "submitted"
      : "approved"

/**
 * `/dashboard/exams`: the exam in-charge's view of one exam: which mark
 * sheets are still missing (and whose they are), approving what is in,
 * publishing results and printing report cards.
 */
export function ExamOverview() {
  const t = useTranslations("exams.overview")
  const exams = useQuery(examsQuery())
  const [picked, setPicked] = useState<string | null>(null)
  const list = (exams.data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const examId = picked ?? list[0]?.id ?? null

  if (exams.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (!list.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noExams")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <NativeSelect
        aria-label={t("exam")}
        className="w-fit"
        value={examId ?? ""}
        onChange={(e) => setPicked(e.target.value)}
      >
        {list.map((e) => (
          <NativeSelectOption key={e.id} value={e.id}>
            {e.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {examId && <ExamBody key={examId} examId={examId} />}
    </div>
  )
}

function ExamBody({ examId }: { examId: string }) {
  const t = useTranslations("exams.overview")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const sheets = useQuery(sheetsQuery(examId))
  const classes = useQuery(classesQuery())
  const [filter, setFilter] = useState<Filter>("pending")

  const approve = useMutation({
    mutationFn: (ids: string[]) => approveSheets(ids),
    onSuccess: async (_, ids) => {
      toast.add({
        title: t("approved", { count: ids.length, n: f.number(ids.length) }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: examKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("approveFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  if (sheets.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (sheets.isError) return null
  const all = sheets.data
  const count = (g: Filter) => all.filter((s) => groupOf(s) === g).length
  const done = count("approved")
  const className = (id: string) =>
    classes.data?.find((c) => c.id === id)?.name ?? ""
  const level = (id: string) =>
    classes.data?.find((c) => c.id === id)?.level ?? 0
  const shown = all
    .filter((s) => groupOf(s) === filter)
    .sort(
      (a, b) =>
        level(a.classId) - level(b.classId) ||
        a.sectionName.localeCompare(b.sectionName) ||
        a.subjectName.localeCompare(b.subjectName)
    )
  const submittedIds = all
    .filter((s) => groupOf(s) === "submitted")
    .map((s) => s.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">{t("progress")}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("progressCount", {
              done: f.number(done),
              total: f.number(all.length),
            })}
          </span>
        </div>
        <Progress value={all.length ? (done / all.length) * 100 : 0} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("show")}
          className="flex flex-wrap gap-1.5"
        >
          {(["pending", "submitted", "approved"] as const).map((g) => (
            <Button
              key={g}
              role="tab"
              aria-selected={filter === g}
              size="sm"
              variant={filter === g ? "default" : "outline"}
              onClick={() => setFilter(g)}
            >
              {t(`filters.${g}`, { n: f.number(count(g)) })}
            </Button>
          ))}
        </div>
        {submittedIds.length > 0 && (
          <Can permission="results:approve">
            <Button
              disabled={approve.isPending}
              onClick={() => approve.mutate(submittedIds)}
            >
              <CheckCheckIcon data-icon="inline-start" />
              {t("approveAll", { n: f.number(submittedIds.length) })}
            </Button>
          </Can>
        )}
      </div>

      {shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t(`empty.${filter}`)}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("classSection")}</TableHead>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("teacher")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    {className(s.classId)} {s.sectionName}
                  </TableCell>
                  <TableCell className="font-medium">{s.subjectName}</TableCell>
                  <TableCell>
                    {s.teacherName ?? (
                      <span className="text-muted-foreground">
                        {t("noTeacher")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={s.status === "draft" ? "outline" : "secondary"}
                    >
                      {t(`sheetStatus.${s.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/exams/marks/${s.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {t("open")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Results examId={examId} />
    </div>
  )
}

function Results({ examId }: { examId: string }) {
  const t = useTranslations("exams.overview")
  const defs = useQuery(definitionsQuery(examId))
  const session = useQuery(currentSessionQuery())
  const sections = useQuery({
    ...sectionsQuery(session.data?.id ?? ""),
    enabled: Boolean(session.data?.id),
  })
  if (!defs.data?.length) return null
  const sorted = defs.data
    .slice()
    .sort((a, b) => (a.schoolClass.level ?? 0) - (b.schoolClass.level ?? 0))
  return (
    <WidgetCard title={t("resultsTitle")} description={t("resultsHint")}>
      <ul className="flex flex-col divide-y">
        {sorted.map((d) => (
          <ResultRow
            key={d.id}
            def={d}
            sections={(sections.data ?? [])
              .filter((s) => s.classId === d.classId)
              .sort((a, b) => a.name.localeCompare(b.name))}
          />
        ))}
      </ul>
    </WidgetCard>
  )
}

function ResultRow({
  def,
  sections,
}: {
  def: ResultDefinition
  sections: { id: string; name: string }[]
}) {
  const t = useTranslations("exams.overview")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const publish = useMutation({
    mutationFn: () => publishResults(def.id),
    onSuccess: async () => {
      toast.add({
        title: t("published", { className: def.schoolClass.name }),
        type: "success",
      })
      await queryClient.invalidateQueries({ queryKey: examKeys.all })
    },
    onError: (error) =>
      toast.add({
        title: t("publishFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const print = useMutation({
    mutationFn: (sectionId: string) => printReportCards(def.id, sectionId),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () => toast.add({ title: t("printFailed"), type: "error" }),
  })
  const s = def.status
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{def.schoolClass.name}</span>
        <span className="text-xs text-muted-foreground">
          {s.published
            ? t("statePublished")
            : s.current
              ? t("stateReady")
              : t("stateWaiting", {
                  approved: f.number(s.approved),
                  sheets: f.number(s.sheets),
                })}
        </span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {!s.published && s.current && (
          <Can permission="results:publish">
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
            >
              {t("publish")}
            </Button>
          </Can>
        )}
        {s.current && (
          <Can permission="report_cards:print">
            {sections.map((sec) => (
              <Button
                key={sec.id}
                size="sm"
                variant="outline"
                disabled={print.isPending}
                onClick={() => print.mutate(sec.id)}
              >
                <PrinterIcon data-icon="inline-start" />
                {t("printSection", { section: sec.name })}
              </Button>
            ))}
          </Can>
        )}
      </div>
    </li>
  )
}
