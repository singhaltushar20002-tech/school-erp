"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCheckIcon, CircleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
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
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  attendanceKeys,
  rosterQuery,
  saveAttendance,
  submissionStatusQuery,
  type AttendanceCode,
  type Roster,
  type SectionDayStatus,
} from "../api"

const CODES: AttendanceCode[] = ["present", "absent", "late", "leave"]

const TONE: Record<AttendanceCode, string> = {
  present:
    "data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground",
  absent:
    "data-[on=true]:border-destructive data-[on=true]:bg-destructive data-[on=true]:text-white",
  late: "data-[on=true]:border-amber-500 data-[on=true]:bg-amber-500 data-[on=true]:text-white",
  leave:
    "data-[on=true]:border-sky-600 data-[on=true]:bg-sky-600 data-[on=true]:text-white",
}

/**
 * `/dashboard/attendance/take`: a class teacher picks a section and marks
 * it in a few taps on a phone. Everyone starts Present; tap the others.
 * The register is in the office's view as soon as it is saved.
 */
export function TakeAttendance() {
  const t = useTranslations("attendanceTake")
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [date, setDate] = useState<string | null>(null)
  const day = date ?? today
  const [sectionId, setSectionId] = useState<string | null>(null)

  const status = useQuery(submissionStatusQuery(day))
  const rows = status.data?.rows ?? []
  // A teacher with one section goes straight to it.
  const selected = sectionId ?? (rows.length === 1 ? rows[0].sectionId : null)

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex flex-col gap-1.5 sm:max-w-48">
        <Label htmlFor="attendance-date">{t("date")}</Label>
        <Input
          id="attendance-date"
          type="date"
          value={day}
          max={today}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value)
          }}
        />
      </div>

      {status.isPending ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-28 rounded-xl" />
          ))}
        </div>
      ) : status.isError ? (
        <Failed onRetry={() => status.refetch()} />
      ) : rows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("noSectionsTitle")}</EmptyTitle>
            <EmptyDescription>{t("noSectionsBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <SectionPicker
          rows={rows}
          selected={selected}
          onSelect={setSectionId}
        />
      )}

      {selected && (
        <Register key={`${selected}:${day}`} sectionId={selected} date={day} />
      )}
    </div>
  )
}

function SectionPicker({
  rows,
  selected,
  onSelect,
}: {
  rows: SectionDayStatus[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const t = useTranslations("attendanceTake")
  const pending = rows.filter((r) => r.status === "pending").length
  // Sections still to mark first, so the office sees who is late.
  const ordered = [...rows].sort(
    (a, b) => Number(b.status === "pending") - Number(a.status === "pending")
  )
  // The office has every section: a compact list beats a wall of buttons.
  if (rows.length > 6) {
    return (
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <Label htmlFor="attendance-section">{t("sections", { pending })}</Label>
        <NativeSelect
          id="attendance-section"
          value={selected ?? ""}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
        >
          <NativeSelectOption value="" disabled>
            {t("pickSection")}
          </NativeSelectOption>
          {ordered.map((row) => (
            <NativeSelectOption key={row.sectionId} value={row.sectionId}>
              {t("sectionOption", {
                section: `${row.className} ${row.sectionName}`,
                state: t(`state.${row.status}`),
              })}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    )
  }
  return (
    <section aria-labelledby="sections-heading" className="flex flex-col gap-2">
      <h2 id="sections-heading" className="text-sm font-medium">
        {t("sections", { pending })}
      </h2>
      <div className="flex flex-wrap gap-2">
        {ordered.map((row) => (
          <button
            key={row.sectionId}
            type="button"
            aria-pressed={row.sectionId === selected}
            onClick={() => onSelect(row.sectionId)}
            className={cn(
              "flex shrink-0 flex-col items-start gap-0.5 rounded-xl border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              row.sectionId === selected && "border-primary ring-1 ring-primary"
            )}
          >
            <span className="text-sm font-medium whitespace-nowrap">
              {row.className} {row.sectionName}
            </span>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                row.status === "submitted"
                  ? "text-muted-foreground"
                  : row.status === "pending"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {t(`state.${row.status}`)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function Register({ sectionId, date }: { sectionId: string; date: string }) {
  const t = useTranslations("attendanceTake")
  const roster = useQuery(rosterQuery(sectionId, date))

  if (roster.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }
  if (roster.isError) return <Failed onRetry={() => roster.refetch()} />
  if (roster.data.dayOff) {
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertTitle>{t("dayOffTitle")}</AlertTitle>
        <AlertDescription>
          {t("dayOffBody", { reason: roster.data.dayOff })}
        </AlertDescription>
      </Alert>
    )
  }
  return <Marking roster={roster.data} />
}

/** The roster with a status per student and the save bar. */
function Marking({ roster }: { roster: Roster }) {
  const t = useTranslations("attendanceTake")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const taken = Boolean(roster.register?.submittedAt)
  const saved = Object.fromEntries(
    roster.students.map((s) => [s.enrollmentId, toCode(s.status)])
  )
  const [marks, setMarks] = useState<Record<string, AttendanceCode>>(saved)
  const [reason, setReason] = useState("")

  const students = roster.students.filter((s) => s.active)
  const changed = students.filter(
    (s) => marks[s.enrollmentId] !== saved[s.enrollmentId]
  )
  const corrections = changed.filter((s) => s.recorded)
  const needsReason = taken && corrections.length > 0
  const counts = Object.fromEntries(
    CODES.map((c) => [
      c,
      students.filter((s) => marks[s.enrollmentId] === c).length,
    ])
  ) as Record<AttendanceCode, number>

  const save = useMutation({
    mutationFn: () => {
      // A new register: everyone not Present. A taken one: the changes.
      const records = (taken ? changed : students)
        .filter((s) => taken || marks[s.enrollmentId] !== "present")
        .map((s) => ({
          enrollmentId: s.enrollmentId,
          status: marks[s.enrollmentId],
        }))
      return saveAttendance(
        roster.section.id,
        roster.date,
        records,
        needsReason ? reason.trim() : undefined
      )
    },
    onSuccess: async () => {
      toast.add({
        title: t("saved", {
          section: `${roster.section.className} ${roster.section.name}`,
        }),
        description: t("savedCounts", {
          present: f.number(counts.present + counts.late),
          absent: f.number(counts.absent),
        }),
        type: "success",
        timeout: 5000,
      })
      setReason("")
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
    },
    onError: (error) => {
      toast.add({
        title: t("saveFailed"),
        description:
          isApiError(error) && error.status !== 500 ? error.message : undefined,
        type: "error",
      })
    },
  })

  if (students.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  const canSave =
    !save.isPending &&
    (!taken || changed.length > 0) &&
    (!needsReason || reason.trim().length >= 3)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          {roster.section.className} {roster.section.name}
          {taken && (
            <Badge variant="secondary" className="ml-2 align-middle">
              {t("takenBadge")}
            </Badge>
          )}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setMarks((m) => ({
              ...m,
              ...Object.fromEntries(
                students
                  .filter((s) => !s.onLeave)
                  .map((s) => [s.enrollmentId, "present" as const])
              ),
            }))
          }
        >
          <CheckCheckIcon data-icon="inline-start" />
          {t("allPresent")}
        </Button>
      </div>
      {roster.locked && (
        <Alert>
          <CircleAlertIcon />
          <AlertDescription>{t("locked")}</AlertDescription>
        </Alert>
      )}

      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {students.map((s) => (
          <li
            key={s.enrollmentId}
            className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="w-7 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {s.rollNo ?? "—"}
              </span>
              <span className="truncate font-medium">{s.name}</span>
              {s.onLeave && (
                <Badge variant="outline" className="shrink-0">
                  {t("onLeave")}
                </Badge>
              )}
            </span>
            <div
              role="radiogroup"
              aria-label={t("statusFor", { name: s.name })}
              className="grid grid-cols-4 gap-1.5 pl-10 sm:pl-0"
            >
              {CODES.map((code) => {
                const on = marks[s.enrollmentId] === code
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-on={on}
                    onClick={() =>
                      setMarks((m) => ({ ...m, [s.enrollmentId]: code }))
                    }
                    className={cn(
                      "h-10 min-w-12 rounded-lg border px-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:min-w-16",
                      TONE[code]
                    )}
                  >
                    {t(`short.${code}`)}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ul>

      {needsReason && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-reason">{t("reason")}</Label>
          <Textarea
            id="attendance-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            maxLength={500}
          />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur md:left-(--sidebar-width)">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p className="flex-1 text-sm tabular-nums" aria-live="polite">
            {t("tally", {
              present: f.number(counts.present),
              absent: f.number(counts.absent),
              late: f.number(counts.late),
              leave: f.number(counts.leave),
            })}
          </p>
          <Button size="lg" disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending
              ? t("saving")
              : taken
                ? t("update", { count: changed.length })
                : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  )
}

const toCode = (status: string): AttendanceCode =>
  (CODES as string[]).includes(status) ? (status as AttendanceCode) : "present"

function Failed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("attendanceTake")
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{t("errorTitle")}</EmptyTitle>
        <EmptyDescription>{t("errorBody")}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Empty>
  )
}
