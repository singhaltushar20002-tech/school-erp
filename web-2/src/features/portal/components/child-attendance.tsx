"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
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
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Textarea } from "~/components/ui/textarea"
import { toast } from "~/components/ui/toast"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  applyLeave,
  attendanceMonthQuery,
  childKeys,
  childLeavesQuery,
  portalKeys,
  type CountsAs,
  type PortalChild,
} from "../api"
import { ChildGate, PageFailed } from "./child-gate"

const TONE: Record<CountsAs, string> = {
  present: "bg-primary/25 text-primary font-medium",
  absent: "bg-destructive/25 text-destructive font-medium",
  late: "bg-amber-500/25 font-medium text-amber-700 dark:text-amber-400",
  leave: "bg-sky-500/25 font-medium text-sky-700 dark:text-sky-400",
  half_day: "bg-violet-500/25 text-violet-700 dark:text-violet-400",
}
const LEGEND: CountsAs[] = ["present", "absent", "late", "leave"]

const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** `/student/attendance`: the month day by day, and leave requests. */
export function ChildAttendance() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("attendanceTitle", { name })}>
      {(child) => <AttendanceBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function AttendanceBody({ child }: { child: PortalChild }) {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [month, setMonth] = useState(today.slice(0, 7))
  const data = useQuery(attendanceMonthQuery(child.studentId, month))

  const [y, m] = month.split("-").map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  // Monday-first grid: blank cells before the 1st.
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const byDate = new Map((data.data?.days ?? []).map((d) => [d.date, d]))
  const tally = Object.fromEntries(
    LEGEND.map((k) => [
      k,
      (data.data?.days ?? []).filter((d) => d.countsAs === k).length,
    ])
  ) as Record<CountsAs, number>

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            <h2>{f.month(month)}</h2>
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("previousMonth")}
              onClick={() => setMonth((v) => shiftMonth(v, -1))}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("nextMonth")}
              disabled={month >= today.slice(0, 7)}
              onClick={() => setMonth((v) => shiftMonth(v, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.isPending ? (
            <Skeleton className="h-64" />
          ) : data.isError ? (
            <PageFailed retry={data.refetch} />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {(
                  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
                ).map((d) => (
                  <span key={d} className="py-1 text-muted-foreground">
                    {t(`weekdays.${d}`)}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`lead-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = `${month}-${String(i + 1).padStart(2, "0")}`
                  const day = byDate.get(date)
                  return (
                    <span
                      key={date}
                      title={day?.label}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center rounded-lg text-sm tabular-nums",
                        day ? TONE[day.countsAs] : "text-muted-foreground/60",
                        date === today && "ring-2 ring-ring"
                      )}
                    >
                      {i + 1}
                      {day && <span className="sr-only">{day.label}</span>}
                    </span>
                  )
                })}
              </div>
              <ul className="flex flex-wrap gap-3 text-sm">
                {LEGEND.map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className={cn("size-3 rounded", TONE[k])} />
                    {t(`legend.${k}`, { n: f.number(tally[k]) })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
      <LeaveCard child={child} today={today} />
    </div>
  )
}

function LeaveCard({ child, today }: { child: PortalChild; today: string }) {
  const t = useTranslations("portal.pages")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const leaves = useQuery(childLeavesQuery(child.studentId))
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [reason, setReason] = useState("")

  const send = useMutation({
    mutationFn: () =>
      applyLeave(child.studentId, {
        fromDate: from,
        ...(to && to !== from ? { toDate: to } : {}),
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      toast.add({ title: t("leaveSent"), type: "success" })
      setFrom("")
      setTo("")
      setReason("")
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: childKeys.leaves(child.studentId),
        }),
        queryClient.invalidateQueries({
          queryKey: portalKeys.dashboard(child.studentId),
        }),
      ])
    },
    onError: (error) =>
      toast.add({
        title: t("leaveFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const valid =
    Boolean(from) && (!to || to >= from) && reason.trim().length >= 3

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("leaveTitle")}</h2>
        </CardTitle>
        <CardDescription>{t("leaveHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !send.isPending) send.mutate()
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-from">{t("leaveFrom")}</Label>
              <Input
                id="leave-from"
                type="date"
                min={today}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leave-to">{t("leaveTo")}</Label>
              <Input
                id="leave-to"
                type="date"
                min={from || today}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-reason">{t("leaveReason")}</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("leaveReasonPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={!valid || send.isPending}>
            {send.isPending ? t("leaveSending") : t("leaveSend")}
          </Button>
        </form>
        {leaves.data && leaves.data.length > 0 && (
          <ul className="flex flex-col divide-y border-t pt-2">
            {leaves.data.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-2.5">
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {l.fromDate === l.toDate
                    ? f.date(l.fromDate)
                    : t("leaveRange", {
                        from: f.date(l.fromDate),
                        to: f.date(l.toDate),
                      })}
                  <Badge
                    variant={
                      l.status === "approved"
                        ? "secondary"
                        : l.status === "rejected"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {t(`leaveStatus.${l.status}`)}
                  </Badge>
                </span>
                <span className="text-sm text-muted-foreground">
                  {l.reason}
                </span>
                {l.decisionNote && (
                  <span className="text-xs text-muted-foreground">
                    {t("leaveNote", { note: l.decisionNote })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
