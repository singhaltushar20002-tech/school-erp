"use client"

import { ChevronLeftIcon, ChevronRightIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import { monthWeeks, shiftMonth, type CalendarItem } from "../api"

const TONE: Record<CalendarItem["kind"], string> = {
  holiday: "bg-destructive/15 text-destructive",
  exam: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  event: "bg-primary/15 text-primary",
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

/**
 * A month of the school calendar: a grid on wide screens, with the same
 * items listed underneath (the list is what phones read).
 */
export function MonthCalendar({
  month,
  items,
  today,
  onMonth,
  onRemove,
}: {
  month: string
  items: CalendarItem[]
  today: string
  onMonth: (month: string) => void
  /** Shown on events when given (staff who may manage events). */
  onRemove?: (item: CalendarItem) => void
}) {
  const t = useTranslations("calendar")
  const f = useSchoolFormat()
  const on = (day: string) =>
    items.filter((i) => i.dateFrom <= day && i.dateTo >= day)
  const label = (i: CalendarItem) =>
    i.kind === "event" && i.eventKind
      ? t(`kinds.${i.eventKind}`)
      : t(`types.${i.kind}`)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("previous")}
          onClick={() => onMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <h2 className="min-w-36 text-center font-display text-lg font-semibold">
          {f.month(month)}
        </h2>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("next")}
          onClick={() => onMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <div className="ms-auto hidden flex-wrap gap-2 text-xs sm:flex">
          {(["holiday", "exam", "event"] as const).map((k) => (
            <span key={k} className={cn("rounded px-2 py-0.5", TONE[k])}>
              {t(`types.${k}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5 font-medium">
              {t(`weekdays.${d}`)}
            </div>
          ))}
        </div>
        {monthWeeks(month).map((week, w) => (
          <div key={w} className="grid grid-cols-7 border-b last:border-0">
            {week.map((day, i) => (
              <div
                key={day ?? `pad-${w}-${i}`}
                className={cn(
                  "min-h-24 border-e p-1.5 last:border-0",
                  !day && "bg-muted/40",
                  i >= 6 && day && "bg-muted/20"
                )}
              >
                {day && (
                  <>
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        day === today && "bg-primary text-primary-foreground"
                      )}
                    >
                      {f.number(Number(day.slice(8)))}
                    </span>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {on(day).map((item) => (
                        <span
                          key={`${item.kind}-${item.id}`}
                          title={item.title}
                          className={cn(
                            "truncate rounded px-1 py-0.5 text-[11px] leading-tight",
                            TONE[item.kind]
                          )}
                        >
                          {item.title}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex items-start gap-3 px-4 py-3"
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs",
                  TONE[item.kind]
                )}
              >
                {label(item)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.dateTo !== item.dateFrom
                    ? t("range", {
                        from: f.date(item.dateFrom),
                        to: f.date(item.dateTo),
                      })
                    : f.date(item.dateFrom)}
                </span>
                {item.description && (
                  <span className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </span>
              {item.kind === "event" && !item.forParents && (
                <Badge variant="outline">{t("staffOnly")}</Badge>
              )}
              {onRemove && item.kind === "event" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove", { title: item.title })}
                  onClick={() => onRemove(item)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
