"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
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
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  childResultQuery,
  childResultsQuery,
  reportCardUrl,
  type PortalChild,
} from "../api"
import { ChildGate, PageFailed } from "./child-gate"

/** `/student/results`: published results, subject marks, the report card. */
export function ChildResults() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("resultsTitle", { name })}>
      {(child) => <ResultsBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function ResultsBody({ child }: { child: PortalChild }) {
  const t = useTranslations("portal.pages")
  const list = useQuery(childResultsQuery(child.studentId))
  const [picked, setPicked] = useState<string | null>(null)

  if (list.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (list.isError) return <PageFailed retry={list.refetch} />
  if (list.data.blocked) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("resultsBlockedTitle")}</EmptyTitle>
          <EmptyDescription>{t("resultsBlockedBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const results = list.data.results
  if (!results.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noResultsTitle")}</EmptyTitle>
          <EmptyDescription>{t("noResultsBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const selected = picked ?? results[0].id
  return (
    <div className="flex flex-col gap-4">
      {results.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {results.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={r.id === selected ? "default" : "outline"}
              onClick={() => setPicked(r.id)}
            >
              {r.name}
            </Button>
          ))}
        </div>
      )}
      <ResultDetail
        studentId={child.studentId}
        resultId={selected}
        title={results.find((r) => r.id === selected)?.name ?? ""}
      />
    </div>
  )
}

function ResultDetail({
  studentId,
  resultId,
  title,
}: {
  studentId: string
  resultId: string
  /** The exam's name (the detail's own `name` is the student's). */
  title: string
}) {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const result = useQuery(childResultQuery(studentId, resultId))
  const download = useMutation({
    mutationFn: () => reportCardUrl(studentId, resultId),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (error) =>
      toast.add({
        title:
          isApiError(error) && error.code === "NO_REPORT_CARD"
            ? t("reportCardNotReady")
            : t("reportCardFailed"),
        type: isApiError(error) && error.status === 404 ? "info" : "error",
      }),
  })

  if (result.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (result.isError) return <PageFailed retry={result.refetch} />
  const r = result.data
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
          <CardDescription>
            {[
              r.percentage != null &&
                t("percentage", { value: f.percent(r.percentage) }),
              r.positionSection != null &&
                t("position", {
                  section: f.number(r.positionSection),
                  className: f.number(r.positionClass ?? 0),
                }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {r.grade && (
            <Badge variant={r.passed === false ? "destructive" : "secondary"}>
              {t("grade", { grade: r.grade })}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            <DownloadIcon data-icon="inline-start" />
            {t("reportCard")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("subject")}</TableHead>
              <TableHead className="text-right">{t("marks")}</TableHead>
              <TableHead className="text-right">{t("gradeHead")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.subjects.map((s) => (
              <TableRow key={s.classSubjectId}>
                <TableCell>{s.subjectName}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.absent
                    ? t("absent")
                    : t("marksOf", {
                        marks: f.number(s.marks ?? 0),
                        full: f.number(s.fullMarks),
                      })}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    s.passed === false && "text-destructive"
                  )}
                >
                  {s.grade ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {r.total != null && r.fullMarks != null && (
              <TableRow className="font-semibold">
                <TableCell>{t("total")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {t("marksOf", {
                    marks: f.number(r.total),
                    full: f.number(r.fullMarks),
                  })}
                </TableCell>
                <TableCell className="text-right">{r.grade ?? "—"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {r.remarks && (
          <p className="mt-3 text-sm text-muted-foreground">{r.remarks}</p>
        )}
      </CardContent>
    </Card>
  )
}
