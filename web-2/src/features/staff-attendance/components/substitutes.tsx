"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { Input } from "~/components/ui/input"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { displaySettingsQuery } from "~/features/settings/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"
import { todayIn } from "~/lib/format"

import { assignSubstitute, staffKeys, uncoveredQuery } from "../api"

/**
 * `/dashboard/staff/substitutes`: the day's periods of absent teachers,
 * and a free teacher for each.
 */
export function Substitutes() {
  const t = useTranslations("substitutes")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const display = useQuery(displaySettingsQuery())
  const today = todayIn(display.data?.locale.timeZone)
  const [date, setDate] = useState<string | null>(null)
  const day = date ?? today
  const data = useQuery(uncoveredQuery(day))
  const assign = useMutation({
    mutationFn: ({
      id,
      employeeId,
    }: {
      id: string
      employeeId: string | null
    }) => assignSubstitute(day, id, employeeId),
    onSuccess: (result) => {
      queryClient.setQueryData(staffKeys.subs(day), result)
      toast.add({ title: t("saved"), type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  const periods = data.data?.periods ?? []
  const open = periods.filter((p) => !p.substitute).length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          className="w-44"
          value={day}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        {data.data && periods.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {t("summary", {
              teachers: f.number(data.data.absentTeachers),
              periods: f.number(periods.length),
              open: f.number(open),
            })}
          </span>
        )}
      </div>
      {data.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : periods.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("none")}</EmptyTitle>
            <EmptyDescription>{t("noneBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {periods.map((p) => (
            <li
              key={p.timetableId}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center"
            >
              <span className="w-24 shrink-0 text-sm">
                <span className="block font-medium">{p.periodName}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {p.startTime}
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {p.className} {p.sectionName} · {p.subjectName}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("usually", { name: p.teacherName })}
                </span>
              </span>
              {!p.substitute && (
                <Badge variant="destructive">{t("uncovered")}</Badge>
              )}
              <NativeSelect
                aria-label={t("substituteFor", {
                  period: p.periodName,
                  cls: `${p.className} ${p.sectionName}`,
                })}
                value={p.substitute?.id ?? ""}
                disabled={assign.isPending}
                onChange={(e) =>
                  assign.mutate({
                    id: p.timetableId,
                    employeeId: e.target.value || null,
                  })
                }
              >
                <NativeSelectOption value="">{t("pick")}</NativeSelectOption>
                {p.free.map((x) => (
                  <NativeSelectOption key={x.id} value={x.id}>
                    {x.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
