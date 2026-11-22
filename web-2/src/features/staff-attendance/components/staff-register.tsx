"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCheckIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import {
  markStaff,
  staffDayQuery,
  staffKeys,
  type StaffDay,
  type StaffStatus,
} from "../api"

const QUICK = ["present", "absent", "late", "half_day"] as const
const TONE: Record<StaffStatus, string> = {
  present: "bg-primary text-primary-foreground",
  absent: "bg-destructive text-white",
  late: "bg-amber-500 text-white",
  half_day: "bg-violet-500 text-white",
  leave: "bg-sky-600 text-white",
  unpaid_leave: "bg-sky-800 text-white",
}

/** `/dashboard/staff/attendance`: the day's staff register. */
export function StaffRegister() {
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [date, setDate] = useState<string | null>(null)
  const day = date ?? today
  const data = useQuery(staffDayQuery(day))
  return (
    <div className="flex flex-col gap-4">
      <Input
        type="date"
        className="w-44"
        max={today}
        value={day}
        onChange={(e) => e.target.value && setDate(e.target.value)}
      />
      {data.isPending ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : data.isError ? null : (
        <Register key={`${day}:${data.dataUpdatedAt}`} day={data.data} />
      )}
    </div>
  )
}

function Register({ day }: { day: StaffDay }) {
  const t = useTranslations("staffAttendance")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [marks, setMarks] = useState<Record<string, StaffStatus | null>>(() =>
    Object.fromEntries(day.staff.map((s) => [s.id, s.status]))
  )
  const changed = day.staff.filter((s) => marks[s.id] !== s.status)
  const unmarked = day.staff.filter((s) => !marks[s.id]).length
  const counts = Object.values(marks).reduce<Record<string, number>>(
    (acc, s) => (s ? { ...acc, [s]: (acc[s] ?? 0) + 1 } : acc),
    {}
  )
  const save = useMutation({
    mutationFn: () =>
      markStaff(
        day.date,
        changed
          .filter((s) => marks[s.id])
          .map((s) => ({ employeeId: s.id, status: marks[s.id]! }))
      ),
    onSuccess: async (data) => {
      queryClient.setQueryData(staffKeys.day(day.date), data)
      await queryClient.invalidateQueries({ queryKey: staffKeys.all })
      toast.add({ title: t("saved"), type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["present", "absent", "late", "half_day", "leave"] as const).map(
          (s) => (
            <span key={s} className="rounded-md border px-2 py-1">
              {t(`statuses.${s}`)}:{" "}
              <b className="tabular-nums">{f.number(counts[s] ?? 0)}</b>
            </span>
          )
        )}
        <Button
          size="sm"
          variant="outline"
          className="ms-auto"
          onClick={() =>
            setMarks((m) =>
              Object.fromEntries(
                Object.entries(m).map(([k, v]) => [k, v ?? "present"])
              )
            )
          }
        >
          <CheckCheckIcon data-icon="inline-start" />
          {t("restPresent", { n: f.number(unmarked) })}
        </Button>
      </div>
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {day.staff.map((s) => {
          const current = marks[s.id]
          const onLeave = current === "leave" || current === "unpaid_leave"
          return (
            <li
              key={s.id}
              className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.designation ?? "—"}
                </span>
              </span>
              {onLeave ? (
                <span
                  className={cn("rounded-md px-2 py-1 text-xs", TONE[current])}
                >
                  {t(`statuses.${current}`)}
                </span>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={t("statusFor", { name: s.name })}
                  className="flex gap-1"
                >
                  {QUICK.map((st) => (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={current === st}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium",
                        current === st ? TONE[st] : "hover:bg-muted"
                      )}
                      onClick={() => setMarks((m) => ({ ...m, [s.id]: st }))}
                    >
                      {t(`short.${st}`)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
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
    </div>
  )
}
