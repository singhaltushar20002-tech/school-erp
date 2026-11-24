"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PrinterIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { submissionStatusQuery } from "~/features/attendance/api"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import {
  allDefinitionsQuery,
  CO_SCHOLASTIC,
  printReportCards,
  resultRowsQuery,
  saveCoScholastic,
  saveRemarks,
  type CoScholasticArea,
  type ResultRow,
} from "../api"

type Entry = { remarks: string } & Partial<Record<CoScholasticArea, string>>

const toEntry = (r: ResultRow): Entry => ({
  remarks: r.remarks ?? "",
  ...(r.coScholastic ?? {}),
})

/**
 * `/dashboard/exams/report-cards`: before printing, the class teacher
 * fills in each student's remarks and co-scholastic grades (work
 * education, art, health and PE, discipline), then prints the section's
 * report cards in English or Hindi.
 */
export function ReportCardEntry() {
  const t = useTranslations("reportCardEntry")
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const sections = useQuery(submissionStatusQuery(today))
  const defs = useQuery(allDefinitionsQuery())
  const [pickedName, setPickedName] = useState<string | null>(null)
  const [pickedSection, setPickedSection] = useState<string | null>(null)

  if (sections.isPending || defs.isPending)
    return <Skeleton className="h-96 rounded-xl" />
  const ready = (defs.data ?? []).filter((d) => d.computedAt)
  const names = [...new Set(ready.map((d) => d.name))]
  const rows = sections.data?.rows ?? []
  if (!names.length || !rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("nothing")}</EmptyTitle>
          <EmptyDescription>{t("nothingBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const name = pickedName ?? names[0]
  const sectionId = pickedSection ?? rows[0].sectionId
  const section = rows.find((r) => r.sectionId === sectionId)
  const definition = ready.find(
    (d) => d.name === name && d.classId === section?.classId
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-result">{t("result")}</Label>
          <NativeSelect
            id="rc-result"
            value={name}
            onChange={(e) => setPickedName(e.target.value)}
          >
            {names.map((n) => (
              <NativeSelectOption key={n} value={n}>
                {n}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-section">{t("section")}</Label>
          <NativeSelect
            id="rc-section"
            value={sectionId}
            onChange={(e) => setPickedSection(e.target.value)}
          >
            {rows.map((r) => (
              <NativeSelectOption key={r.sectionId} value={r.sectionId}>
                {r.className} {r.sectionName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        {definition && (
          <PrintButton definitionId={definition.id} sectionId={sectionId} />
        )}
      </div>
      {definition ? (
        <EntryGrid
          key={`${definition.id}:${sectionId}`}
          definitionId={definition.id}
          sectionId={sectionId}
        />
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("notTabulated")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function PrintButton({
  definitionId,
  sectionId,
}: {
  definitionId: string
  sectionId: string
}) {
  const t = useTranslations("reportCardEntry")
  const [language, setLanguage] = useState<"en" | "hi">("en")
  const print = useMutation({
    mutationFn: () => printReportCards(definitionId, sectionId, language),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () => toast.add({ title: t("printFailed"), type: "error" }),
  })
  return (
    <Can permission="report_cards:print">
      <div className="ms-auto flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rc-language">{t("language")}</Label>
          <NativeSelect
            id="rc-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
          >
            <NativeSelectOption value="en">{t("english")}</NativeSelectOption>
            <NativeSelectOption value="hi">{t("hindi")}</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button disabled={print.isPending} onClick={() => print.mutate()}>
          <PrinterIcon data-icon="inline-start" />
          {print.isPending ? t("printing") : t("print")}
        </Button>
      </div>
    </Can>
  )
}

function EntryGrid({
  definitionId,
  sectionId,
}: {
  definitionId: string
  sectionId: string
}) {
  const results = useQuery(resultRowsQuery(definitionId, sectionId))
  if (results.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (results.isError) return null
  return (
    <Grid
      key={results.dataUpdatedAt}
      definitionId={definitionId}
      sectionId={sectionId}
      rows={results.data
        .slice()
        .sort(
          (a, b) =>
            Number(a.rollNo ?? 1e9) - Number(b.rollNo ?? 1e9) ||
            a.name.localeCompare(b.name)
        )}
    />
  )
}

function Grid({
  definitionId,
  sectionId,
  rows,
}: {
  definitionId: string
  sectionId: string
  rows: ResultRow[]
}) {
  const t = useTranslations("reportCardEntry")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, toEntry(r)]))
  )
  const changed = rows.filter(
    (r) => JSON.stringify(toEntry(r)) !== JSON.stringify(draft[r.id])
  )
  const save = useMutation({
    mutationFn: async () => {
      for (const r of changed) {
        const before = toEntry(r)
        const now = draft[r.id]
        if (before.remarks !== now.remarks) await saveRemarks(r.id, now.remarks)
        const grades = Object.fromEntries(
          CO_SCHOLASTIC.map((a) => [a, now[a] ?? ""])
        )
        if (CO_SCHOLASTIC.some((a) => (before[a] ?? "") !== (now[a] ?? "")))
          await saveCoScholastic(r.id, grades)
      }
    },
    onSuccess: async () => {
      toast.add({
        title: t("saved", {
          count: changed.length,
          n: f.number(changed.length),
        }),
        type: "success",
      })
      await queryClient.invalidateQueries({
        queryKey: ["exams", "results", definitionId, sectionId],
      })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const set = (id: string, patch: Partial<Entry>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }))

  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="w-12 px-3 py-2 font-medium">{t("roll")}</th>
              <th className="px-3 py-2 font-medium">{t("student")}</th>
              <th className="px-3 py-2 font-medium">{t("score")}</th>
              {CO_SCHOLASTIC.map((a) => (
                <th key={a} className="px-2 py-2 font-medium">
                  {t(`areas.${a}`)}
                </th>
              ))}
              <th className="min-w-56 px-3 py-2 font-medium">{t("remarks")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                  {r.rollNo ?? "—"}
                </td>
                <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                  {r.name}
                </td>
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
                  {f.percent(Math.round(r.percentage * 10) / 10)} · {r.grade}
                </td>
                {CO_SCHOLASTIC.map((a) => (
                  <td key={a} className="px-2 py-1.5">
                    <NativeSelect
                      className="w-18"
                      aria-label={t("gradeFor", {
                        area: t(`areas.${a}`),
                        name: r.name,
                      })}
                      value={draft[r.id][a] ?? ""}
                      onChange={(e) => set(r.id, { [a]: e.target.value })}
                    >
                      <NativeSelectOption value="">—</NativeSelectOption>
                      {(["A", "B", "C"] as const).map((g) => (
                        <NativeSelectOption key={g} value={g}>
                          {g}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <Input
                    aria-label={t("remarksFor", { name: r.name })}
                    value={draft[r.id].remarks}
                    maxLength={1000}
                    onChange={(e) => set(r.id, { remarks: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("scaleHint")}</p>
      <Can permission="results:remarks">
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:left-(--sidebar-width)">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <p
              className="flex-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {changed.length
                ? t("unsaved", {
                    count: changed.length,
                    n: f.number(changed.length),
                  })
                : t("allSaved")}
            </p>
            <Button
              disabled={!changed.length || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  )
}
