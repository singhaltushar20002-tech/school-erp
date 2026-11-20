"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
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
import { runExport } from "~/features/exports/export-button"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  monthlyRegisterQuery,
  registerCorrectionsQuery,
  submissionStatusQuery,
  type CountsAs,
  type MonthlyRegister as Register,
} from "../api"

const TONE: Record<CountsAs, string> = {
  present: "text-emerald-700 dark:text-emerald-400",
  absent: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  late: "text-amber-700 dark:text-amber-400",
  leave: "text-sky-700 dark:text-sky-400",
  half_day: "text-amber-700 dark:text-amber-400",
}

/**
 * `/dashboard/attendance/registers`: a section's register for a month, the
 * way it looks on paper: one row per student, one column per day, with the
 * month's totals, and the same register as a PDF to print.
 */
export function MonthlyRegister() {
  const t = useTranslations("attendanceRegister")
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const sections = useQuery(submissionStatusQuery(today))
  const [picked, setPicked] = useState<string | null>(null)
  const [month, setMonth] = useState(today.slice(0, 7))
  const rows = sections.data?.rows ?? []
  const sectionId = picked ?? rows[0]?.sectionId ?? null

  const print = useMutation({
    mutationFn: () =>
      runExport("/attendance/reports/monthly-register", {
        sectionId,
        month,
        paper: "A4-landscape",
      }),
    onSuccess: (url) => window.open(url, "_blank", "noopener"),
    onError: () => toast.add({ title: t("printFailed"), type: "error" }),
  })

  if (sections.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (!rows.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noSections")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-section">{t("section")}</Label>
          <NativeSelect
            id="register-section"
            value={sectionId ?? ""}
            onChange={(e) => setPicked(e.target.value)}
          >
            {rows.map((r) => (
              <NativeSelectOption key={r.sectionId} value={r.sectionId}>
                {r.className} {r.sectionName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="register-month">{t("month")}</Label>
          <Input
            id="register-month"
            type="month"
            className="w-44"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="ms-auto"
          disabled={!sectionId || print.isPending}
          onClick={() => print.mutate()}
        >
          <PrinterIcon data-icon="inline-start" />
          {print.isPending ? t("preparing") : t("print")}
        </Button>
      </div>
      {sectionId && <RegisterGrid sectionId={sectionId} month={month} />}
      {sectionId && <Corrections sectionId={sectionId} month={month} />}
    </div>
  )
}

function RegisterGrid({
  sectionId,
  month,
}: {
  sectionId: string
  month: string
}) {
  const t = useTranslations("attendanceRegister")
  const f = useSchoolFormat()
  const register = useQuery(monthlyRegisterQuery(sectionId, month))
  if (register.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (register.isError) return null
  const r: Register = register.data
  const tone = new Map(r.legend.map((l) => [l.symbol, TONE[l.countsAs]]))
  const taken = r.days.filter((d) => d.taken).length
  if (!r.students.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noStudents")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("summary", {
          section: `${r.section.className} ${r.section.name}`,
          month: f.month(r.month),
          count: taken,
          days: f.number(taken),
        })}
      </p>
      {taken === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("nothingTaken")}</EmptyTitle>
            <EmptyDescription>{t("nothingTakenBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="sticky start-0 z-10 bg-card px-2 py-2 text-start font-medium">
                {t("roll")}
              </th>
              <th className="sticky start-10 z-10 min-w-40 bg-card px-2 py-2 text-start font-medium">
                {t("student")}
              </th>
              {r.days.map((d) => (
                <th
                  key={d.date}
                  title={d.offName ?? undefined}
                  className={cn(
                    "w-7 px-0.5 py-1 text-center font-medium",
                    d.off && "bg-muted"
                  )}
                >
                  <span className="block tabular-nums">{f.number(d.day)}</span>
                  <span className="block text-[10px] font-normal">
                    {d.weekday.slice(0, 2)}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-end font-medium">{t("present")}</th>
              <th className="px-2 py-2 text-end font-medium">{t("absent")}</th>
              <th className="px-2 py-2 text-end font-medium">{t("percent")}</th>
            </tr>
          </thead>
          <tbody>
            {r.students.map((s) => (
              <tr key={s.enrollmentId} className="border-b last:border-0">
                <td className="sticky start-0 z-10 bg-card px-2 py-1 text-muted-foreground tabular-nums">
                  {s.rollNo ?? "—"}
                </td>
                <td className="sticky start-10 z-10 bg-card px-2 py-1 font-medium whitespace-nowrap">
                  {s.name}
                </td>
                {s.cells.map((c, i) => (
                  <td
                    key={r.days[i].date}
                    className={cn(
                      "px-0.5 py-1 text-center font-medium",
                      r.days[i].off && "bg-muted",
                      c && tone.get(c)
                    )}
                  >
                    {c}
                  </td>
                ))}
                <td className="px-2 py-1 text-end tabular-nums">
                  {f.number(s.present + s.late + s.halfDay)}
                </td>
                <td className="px-2 py-1 text-end tabular-nums">
                  {f.number(s.absent)}
                </td>
                <td
                  className={cn(
                    "px-2 py-1 text-end font-medium tabular-nums",
                    s.percentage != null &&
                      s.percentage < 75 &&
                      "text-destructive"
                  )}
                >
                  {s.percentage == null ? "—" : f.percent(s.percentage)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t text-muted-foreground">
              <td className="sticky start-0 z-10 bg-card" />
              <td className="sticky start-10 z-10 bg-card px-2 py-1 font-medium">
                {t("attendedRow")}
              </td>
              {r.days.map((d) => (
                <td
                  key={d.date}
                  className={cn(
                    "px-0.5 py-1 text-center tabular-nums",
                    d.off && "bg-muted"
                  )}
                >
                  {d.taken ? f.number(d.attended) : ""}
                </td>
              ))}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {r.legend.map((l) => (
          <li key={l.symbol}>
            <span className={cn("font-semibold", TONE[l.countsAs])}>
              {l.symbol}
            </span>{" "}
            {l.label}
          </li>
        ))}
        <li>
          <span className="inline-block size-3 rounded-sm bg-muted align-middle" />{" "}
          {t("offDay")}
        </li>
      </ul>
    </div>
  )
}

const STATUS_KEYS = ["present", "absent", "late", "leave", "half_day"] as const
const isStatusKey = (c: string): c is (typeof STATUS_KEYS)[number] =>
  (STATUS_KEYS as readonly string[]).includes(c)

/** Changes made to the month's register after it was first taken. */
function Corrections({
  sectionId,
  month,
}: {
  sectionId: string
  month: string
}) {
  const t = useTranslations("attendanceRegister")
  const f = useSchoolFormat()
  const list = useQuery(registerCorrectionsQuery(sectionId, month))
  if (list.isPending || list.isError) return null
  const label = (code: string) =>
    isStatusKey(code) ? t(`statuses.${code}`) : code
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold">
        {t("correctionsTitle")}
      </h2>
      {list.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCorrections")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card text-sm">
          {list.data.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 px-4 py-2.5">
              <span>
                <span className="font-medium">{c.studentName}</span>{" "}
                <span className="text-muted-foreground">
                  {t("correctionDay", { date: f.date(c.date) })}
                </span>
                {" · "}
                {t("correctionChange", {
                  from: label(c.oldStatus),
                  to: label(c.newStatus),
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("correctionBy", {
                  reason: c.reason,
                  who: c.changedByName ?? t("system"),
                  when: f.dateTime(c.changedAt),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
