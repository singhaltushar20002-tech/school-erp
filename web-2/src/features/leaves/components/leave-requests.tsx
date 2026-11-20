"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarRangeIcon, CheckIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { Can } from "~/features/access/can"
import { attendanceKeys } from "~/features/attendance/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  decideLeave,
  leaveDays,
  leaveKeys,
  leavesQuery,
  type LeaveRequest,
  type LeaveStatus,
} from "../api"

type Filter = Exclude<LeaveStatus, "cancelled"> | "all"

const FILTERS: Filter[] = ["pending", "approved", "rejected", "all"]

/**
 * `/dashboard/attendance/leaves`: leave parents asked for. The class
 * teacher approves or rejects; an approved leave marks those days Leave
 * in the register, already taken or not.
 */
export function LeaveRequests() {
  const t = useTranslations("leaves")
  const [status, setStatus] = useState<Filter>("pending")
  const list = useQuery(leavesQuery(status))

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={t("filter")}
        className="flex flex-wrap gap-1.5"
      >
        {FILTERS.map((s) => (
          <Button
            key={s}
            role="tab"
            aria-selected={status === s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {t(`filters.${s}`)}
          </Button>
        ))}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : !list.data?.items.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.items.map((leave) => (
            <LeaveCard key={leave.id} leave={leave} />
          ))}
        </ul>
      )}
    </div>
  )
}

function LeaveCard({ leave }: { leave: LeaveRequest }) {
  const t = useTranslations("leaves")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const [note, setNote] = useState("")
  const days = leaveDays(leave.fromDate, leave.toDate)
  const section = leave.enrollment.section

  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      decideLeave(leave.id, decision, note.trim() || undefined),
    onSuccess: async (_, decision) => {
      toast.add({
        title: t(decision === "approve" ? "approved" : "rejected", {
          name: leave.student.fullName,
        }),
        type: "success",
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: leaveKeys.all }),
        queryClient.invalidateQueries({ queryKey: attendanceKeys.all }),
      ])
    },
    onError: (error) =>
      toast.add({
        title: t("decideFailed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-medium">{leave.student.fullName}</span>
          <span className="text-sm text-muted-foreground">
            {section.schoolClass.name} {section.name}
            {leave.enrollment.rollNo &&
              ` · ${t("roll", { roll: leave.enrollment.rollNo })}`}
          </span>
        </div>
        <Badge
          variant={
            leave.status === "approved"
              ? "secondary"
              : leave.status === "rejected"
                ? "destructive"
                : "outline"
          }
        >
          {t(`status.${leave.status}`)}
        </Badge>
      </div>
      <p className="flex items-center gap-2 text-sm">
        <CalendarRangeIcon className="size-4 text-muted-foreground" />
        {leave.fromDate === leave.toDate
          ? f.date(leave.fromDate)
          : t("range", {
              from: f.date(leave.fromDate),
              to: f.date(leave.toDate),
            })}
        <span className="text-muted-foreground">
          {t("days", { count: days, n: f.number(days) })}
        </span>
      </p>
      <p className="rounded-lg bg-muted/50 p-3 text-sm">{leave.reason}</p>
      {leave.decisionNote && (
        <p className="text-sm text-muted-foreground">
          {t("note", { note: leave.decisionNote })}
        </p>
      )}
      {leave.status === "pending" && (
        <Can permission="student_leaves:approve">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              aria-label={t("noteLabel")}
              maxLength={200}
              className="sm:flex-1"
            />
            <div className="flex gap-2">
              <Button
                className={cn("flex-1 sm:flex-none")}
                disabled={decide.isPending}
                onClick={() => decide.mutate("approve")}
              >
                <CheckIcon data-icon="inline-start" />
                {t("approve")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 sm:flex-none"
                disabled={decide.isPending}
                onClick={() => decide.mutate("reject")}
              >
                <XIcon data-icon="inline-start" />
                {t("reject")}
              </Button>
            </div>
          </div>
        </Can>
      )}
    </li>
  )
}
