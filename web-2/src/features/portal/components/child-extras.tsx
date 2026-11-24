"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  DownloadIcon,
} from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { MonthCalendar } from "~/features/calendar/components/month-calendar"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { dayOf } from "~/features/timetable/api"
import { WeekGrid } from "~/features/timetable/components/timetable-grid"
import { todayIn } from "~/lib/format"
import { cn } from "~/lib/utils"

import { FINE_PER_DAY } from "~/features/library/api"
import { RouteMap } from "~/features/transport/components/route-map"

import {
  childCalendarQuery,
  childHomeworkQuery,
  childLibraryQuery,
  childTimetableQuery,
  childTransportQuery,
  type PortalChild,
} from "../api"
import { withChild } from "../portal-nav"
import { ChildGate, PageFailed } from "./child-gate"

function useToday() {
  const display = useQuery(displaySettingsQuery())
  return todayIn(display.data?.locale.timeZone)
}

/** `/student/homework`: what is due, and what was handed in. */
export function ChildHomework() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("homeworkTitle", { name })}>
      {(child) => <HomeworkBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function HomeworkBody({ child }: { child: PortalChild }) {
  const t = useTranslations("portal.homework")
  const f = useSchoolFormat()
  const today = useToday()
  const list = useQuery(childHomeworkQuery(child.studentId))
  if (list.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (list.isError) return <PageFailed retry={list.refetch} />
  if (!list.data.length)
    return <p className="text-sm text-muted-foreground">{t("none")}</p>
  const due = list.data.filter((h) => h.dueDate >= today)
  const past = list.data.filter((h) => h.dueDate < today)
  const section = (title: string, items: typeof list.data) =>
    items.length > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <ul className="flex flex-col gap-2">
          {items.map((h) => (
            <li key={h.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs font-medium text-primary">
                        {h.subjectName}
                      </span>
                      <span className="font-medium">{h.title}</span>
                    </span>
                    {h.handedIn ? (
                      <Badge>
                        <CheckCircle2Icon data-icon="inline-start" />
                        {t("handedIn")}
                      </Badge>
                    ) : h.dueDate < today ? (
                      <Badge variant="destructive">{t("notHandedIn")}</Badge>
                    ) : (
                      <Badge variant="outline">
                        <CircleIcon data-icon="inline-start" />
                        {t("pending")}
                      </Badge>
                    )}
                  </div>
                  {h.description && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {h.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        h.dueDate === today && "font-medium text-foreground"
                      )}
                    >
                      {h.dueDate === today
                        ? t("dueToday")
                        : t("due", { date: f.date(h.dueDate) })}
                    </span>
                    {h.attachmentLinks.map((a) => (
                      <a
                        key={a.fileId}
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        <DownloadIcon className="size-3.5" />
                        {a.name}
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    )
  return (
    <div className="flex flex-col gap-6">
      {section(t("dueTitle"), due)}
      {section(t("pastTitle"), past)}
    </div>
  )
}

/** `/student/timetable`: the week, today's column highlighted. */
export function ChildTimetable() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("timetableTitle", { name })}>
      {(child) => <TimetableBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function TimetableBody({ child }: { child: PortalChild }) {
  const t = useTranslations("portal.timetable")
  const today = useToday()
  const data = useQuery(childTimetableQuery(child.studentId))
  if (data.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (data.isError) return <PageFailed retry={data.refetch} />
  if (!data.data.timetable)
    return <p className="text-sm text-muted-foreground">{t("notPublished")}</p>
  return <WeekGrid grid={data.data.timetable} today={dayOf(today)} />
}

/** `/student/calendar`: holidays, exams and school events by month. */
export function ChildCalendar() {
  const t = useTranslations("portal.pages")
  return (
    <ChildGate title={(name) => t("calendarTitle", { name })}>
      {(child) => <CalendarBody key={child.studentId} child={child} />}
    </ChildGate>
  )
}

function CalendarBody({ child }: { child: PortalChild }) {
  const today = useToday()
  const [month, setMonth] = useState(today.slice(0, 7))
  const data = useQuery(childCalendarQuery(child.studentId, month))
  if (data.isPending) return <Skeleton className="h-64 rounded-xl" />
  if (data.isError) return <PageFailed retry={data.refetch} />
  return (
    <MonthCalendar
      month={month}
      today={today}
      items={data.data.items}
      onMonth={setMonth}
    />
  )
}

/** Home: today's periods and links to the timetable and calendar. */
export function TodayCard({ studentId }: { studentId: string }) {
  const t = useTranslations("portal.today")
  const today = useToday()
  const data = useQuery(childTimetableQuery(studentId))
  const grid = data.data?.timetable
  const day = dayOf(today)
  const periods = grid
    ? grid.periods
        .map((p) => ({
          period: p,
          slot: grid.slots.find(
            (s) => s.periodId === p.id && s.dayOfWeek === day
          ),
        }))
        .filter((x) => x.slot)
    : []
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.isPending ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : !grid ? (
          <p className="text-sm text-muted-foreground">{t("notPublished")}</p>
        ) : periods.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClasses")}</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {periods.map(({ period, slot }) => (
              <li
                key={period.id}
                className="flex items-center gap-3 py-1.5 text-sm"
              >
                <span className="flex w-24 shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <ClockIcon className="size-3" />
                  {period.startTime ?? period.name}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {slot!.subjectName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {slot!.teacherName}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={withChild("/student/timetable", studentId)}
            className="font-medium text-primary hover:underline"
          >
            {t("week")}
          </Link>
          <Link
            href={withChild("/student/calendar", studentId)}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <CalendarDaysIcon className="size-3.5" />
            {t("calendar")}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/** Home: the child's bus (route, stop, where it is) and library books out. */
export function BusAndBooks({ studentId }: { studentId: string }) {
  const t = useTranslations("portal.extras")
  const f = useSchoolFormat()
  const bus = useQuery(childTransportQuery(studentId))
  const books = useQuery(childLibraryQuery(studentId))
  const transport = bus.data?.transport
  const stop = transport?.route.stops.find((s) => s.id === transport.stopId)
  if (!transport && !books.data?.length) return null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {transport && stop && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>{transport.route.name}</h2>
            </CardTitle>
            <CardDescription>
              {t("busStop", {
                stop: stop.name,
                pickup: stop.pickupTime ?? "—",
                drop: stop.dropTime ?? "—",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <RouteMap
              stops={transport.route.stops}
              live={transport.live}
              highlight={stop.id}
            />
            {transport.route.driverName && (
              <p className="text-xs text-muted-foreground">
                {t("driver", {
                  name: transport.route.driverName,
                  phone: transport.route.driverPhone ?? "",
                  vehicle: transport.route.vehicleNumber ?? "",
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {books.data && books.data.length > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>{t("booksTitle")}</h2>
            </CardTitle>
            <CardDescription>
              {t("booksHint", { fine: f.money(FINE_PER_DAY) })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {books.data.map((b) => (
                <li key={b.id} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {b.title}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      b.daysOverdue > 0
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {b.daysOverdue > 0
                      ? t("overdue", { n: f.number(b.daysOverdue) })
                      : t("due", { date: f.date(b.dueOn) })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
