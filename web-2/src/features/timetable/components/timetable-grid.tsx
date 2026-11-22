"use client"

import { useTranslations } from "next-intl"

import { cn } from "~/lib/utils"

import type { Day, TimetableGrid } from "../api"

/**
 * The week as a table: periods down, days across. `onCell` makes cells
 * buttons (the builder); without it the grid is read-only.
 */
export function WeekGrid({
  grid,
  today,
  onCell,
}: {
  grid: TimetableGrid
  today?: Day
  onCell?: (day: Day, periodId: string) => void
}) {
  const t = useTranslations("timetable")
  const slot = (day: Day, periodId: string) =>
    grid.slots.find((s) => s.dayOfWeek === day && s.periodId === periodId)
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="w-28 px-3 py-2 font-medium">{t("period")}</th>
            {grid.days.map((d) => (
              <th
                key={d}
                className={cn(
                  "px-2 py-2 font-medium",
                  d === today && "text-primary"
                )}
              >
                {t(`days.${d}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.periods.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="px-3 py-2 align-top">
                <span className="block font-medium">{p.name}</span>
                {p.startTime && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.startTime}–{p.endTime}
                  </span>
                )}
              </td>
              {grid.days.map((d) => {
                const s = slot(d, p.id)
                const body = s ? (
                  <>
                    <span className="block truncate font-medium">
                      {s.subjectName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.teacherName}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {onCell ? t("add") : "—"}
                  </span>
                )
                return (
                  <td
                    key={d}
                    className={cn(
                      "p-1 align-top",
                      d === today && "bg-primary/5"
                    )}
                  >
                    {onCell ? (
                      <button
                        type="button"
                        className="flex min-h-12 w-full flex-col items-start rounded-md px-2 py-1 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        aria-label={t("editCell", {
                          day: t(`days.${d}`),
                          period: p.name,
                        })}
                        onClick={() => onCell(d, p.id)}
                      >
                        {body}
                      </button>
                    ) : (
                      <div className="min-h-12 px-2 py-1">{body}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
