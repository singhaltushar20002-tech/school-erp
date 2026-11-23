"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalculatorIcon,
  DownloadIcon,
  MegaphoneIcon,
  TrophyIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
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
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  allDefinitionsQuery,
  analysisQuery,
  exportResults,
  meritListQuery,
  publishResults,
  RESULT_SHEETS,
  tabulateResults,
  type ResultDefinition,
  type ResultSheet,
} from "../api"

type View = "merit" | "failed" | "analysis"

/**
 * `/dashboard/exams/results`: a class's result for an exam, once its
 * mark sheets are approved: merit list with positions, students who
 * failed, and subject-wise analysis. Tabulate, publish and download here.
 */
export function ResultsScreen() {
  const t = useTranslations("resultsScreen")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const definitions = useQuery(allDefinitionsQuery())
  const exams = [...new Set((definitions.data ?? []).map((d) => d.name))]
  const [examName, setExamName] = useState("")
  const exam = examName || exams[0] || ""
  const forExam = (definitions.data ?? [])
    .filter((d) => d.name === exam)
    .sort((a, b) => (a.schoolClass.level ?? 0) - (b.schoolClass.level ?? 0))
  const [pickedId, setPickedId] = useState("")
  const def: ResultDefinition | undefined =
    forExam.find((d) => d.id === pickedId) ?? forExam[0]
  const id = def?.computedAt ? def.id : ""
  const merit = useQuery(meritListQuery(id))
  const analysis = useQuery(analysisQuery(id))
  const [view, setView] = useState<View>("merit")
  const [sectionId, setSectionId] = useState("")
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["exams"] })
  const tabulate = useMutation({
    mutationFn: () => tabulateResults(def!.id),
    onSuccess: async () => {
      toast.add({ title: t("tabulated"), type: "success" })
      await refresh()
    },
    onError: fail,
  })
  const publish = useMutation({
    mutationFn: () => publishResults(def!.id),
    onSuccess: async () => {
      toast.add({ title: t("published"), type: "success" })
      await refresh()
    },
    onError: fail,
  })
  const download = useMutation({
    mutationFn: (v: { type: ResultSheet; format: "xlsx" | "pdf" }) =>
      exportResults(def!.id, v.type, v.format),
    onSuccess: (url) => window.location.assign(url),
    onError: fail,
  })

  if (definitions.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (!def)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noExams")}</EmptyTitle>
          <EmptyDescription>{t("noExamsBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  const rows = (merit.data ?? []).filter(
    (r) => !sectionId || r.sectionId === sectionId
  )
  const sections = [
    ...new Map(
      (merit.data ?? []).map((r) => [r.sectionId, r.sectionName])
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]))
  const passed = rows.filter((r) => r.passed).length
  const average = rows.length
    ? rows.reduce((n, r) => n + r.percentage, 0) / rows.length
    : 0
  const shown =
    view === "failed"
      ? rows.filter((r) => !r.passed)
      : rows
          .slice()
          .sort(
            (a, b) =>
              (sectionId
                ? (a.positionSection ?? 999) - (b.positionSection ?? 999)
                : (a.positionClass ?? 999) - (b.positionClass ?? 999)) ||
              a.name.localeCompare(b.name)
          )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("exam")}
          value={exam}
          onChange={(e) => {
            setExamName(e.target.value)
            setPickedId("")
          }}
        >
          {exams.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("class")}
          value={def.id}
          onChange={(e) => {
            setPickedId(e.target.value)
            setSectionId("")
          }}
        >
          {forExam.map((d) => (
            <NativeSelectOption key={d.id} value={d.id}>
              {d.schoolClass.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {sections.length > 1 && (
          <NativeSelect
            aria-label={t("section")}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <NativeSelectOption value="">{t("allSections")}</NativeSelectOption>
            {sections.map(([sid, name]) => (
              <NativeSelectOption key={sid} value={sid}>
                {t("sectionName", { name })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {def.status.published ? (
            <Badge>{t("statusPublished")}</Badge>
          ) : def.computedAt ? (
            <Badge variant="secondary">{t("statusReady")}</Badge>
          ) : (
            <Badge variant="outline">
              {t("statusSheets", {
                approved: f.number(def.status.approved),
                sheets: f.number(def.status.sheets),
              })}
            </Badge>
          )}
          {def.status.allApproved && (
            <Can permission="results:approve">
              <Button
                variant="outline"
                size="sm"
                disabled={tabulate.isPending}
                onClick={() => tabulate.mutate()}
              >
                <CalculatorIcon data-icon="inline-start" />
                {tabulate.isPending
                  ? t("tabulating")
                  : def.computedAt
                    ? t("retabulate")
                    : t("tabulate")}
              </Button>
            </Can>
          )}
          {def.computedAt && !def.status.published && def.status.current && (
            <Can permission="results:publish">
              <Button
                size="sm"
                disabled={publish.isPending}
                onClick={() => publish.mutate()}
              >
                <MegaphoneIcon data-icon="inline-start" />
                {t("publish")}
              </Button>
            </Can>
          )}
          {def.computedAt && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={download.isPending}
                  />
                }
              >
                <DownloadIcon data-icon="inline-start" />
                {download.isPending ? t("preparing") : t("download")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {RESULT_SHEETS.flatMap((type) =>
                  (["xlsx", "pdf"] as const).map((format) => (
                    <DropdownMenuItem
                      key={`${type}-${format}`}
                      onClick={() => download.mutate({ type, format })}
                    >
                      {t(`sheets.${type}`)} ({t(`formats.${format}`)})
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>

      {!def.computedAt ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("notReady")}</EmptyTitle>
            <EmptyDescription>
              {def.status.allApproved
                ? t("notTabulatedBody")
                : t("notApprovedBody")}
            </EmptyDescription>
          </EmptyHeader>
          <Link
            href="/dashboard/exams"
            className="text-sm text-primary hover:underline"
          >
            {t("toExams")}
          </Link>
        </Empty>
      ) : merit.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat label={t("students")} value={f.number(rows.length)} />
            <Stat
              label={t("passRate")}
              value={f.percent(
                rows.length ? Math.round((passed / rows.length) * 1000) / 10 : 0
              )}
            />
            <Stat
              label={t("average")}
              value={f.percent(Math.round(average * 10) / 10)}
            />
            <Stat
              label={t("failedCount")}
              value={f.number(rows.length - passed)}
              warn={rows.length - passed > 0}
            />
          </dl>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="merit">{t("tabs.merit")}</TabsTrigger>
              <TabsTrigger value="failed">
                {t("tabs.failed", { n: f.number(rows.length - passed) })}
              </TabsTrigger>
              <TabsTrigger value="analysis">{t("tabs.analysis")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {view === "analysis" ? (
            analysis.isPending ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <div className="rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("subject")}</TableHead>
                      <TableHead className="text-right">{t("sat")}</TableHead>
                      <TableHead className="text-right">
                        {t("passRate")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("average")}
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        {t("highest")}
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        {t("lowest")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(analysis.data ?? []).map((s) => (
                      <TableRow key={s.classSubjectId}>
                        <TableCell className="font-medium">
                          {s.subjectName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.number(s.sat)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            s.passRate < 90 && "text-destructive"
                          )}
                        >
                          {f.percent(s.passRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.number(s.average)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">
                          {f.number(s.highest)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums md:table-cell">
                          {f.number(s.lowest)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : shown.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>
                  {view === "failed" ? t("noneFailed") : t("noResults")}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("position")}</TableHead>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("section")}
                    </TableHead>
                    <TableHead className="text-right">{t("total")}</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>{t("grade")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => {
                    const pos = sectionId ? r.positionSection : r.positionClass
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="tabular-nums">
                          {pos && pos <= 3 && r.passed ? (
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <TrophyIcon className="size-4 text-amber-500" />
                              {f.number(pos)}
                            </span>
                          ) : pos ? (
                            f.number(pos)
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/students/${r.studentId}`}
                            className="font-medium hover:underline"
                          >
                            {r.name}
                          </Link>
                          <span className="block font-mono text-xs text-muted-foreground">
                            {r.admissionNumber}
                            {r.rollNo && ` · ${t("roll", { roll: r.rollNo })}`}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {r.sectionName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.number(r.total)}/{f.number(r.fullMarks)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.number(r.percentage)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={r.passed ? "secondary" : "destructive"}
                          >
                            {r.grade}
                          </Badge>
                          {!r.passed && r.failedCount > 0 && (
                            <span className="ms-2 text-xs text-destructive">
                              {t("failedIn", { n: f.number(r.failedCount) })}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tabular-nums",
          warn && "text-destructive"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
