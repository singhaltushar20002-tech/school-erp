"use client"

import { useQuery } from "@tanstack/react-query"
import { BanknoteIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { buttonVariants } from "~/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Can } from "~/features/access/can"
import { classesQuery } from "~/features/academics/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { cn } from "~/lib/utils"

import {
  ageGroup,
  daysOverdue,
  defaultersQuery,
  type AgeGroup,
  type Defaulter,
} from "../api"

const GROUPS: AgeGroup[] = ["0-30", "31-60", "60+"]

/**
 * `/dashboard/fees/dues`: students with overdue fees, grouped by how long
 * their oldest unpaid bill has been due (0–30, 31–60, over 60 days).
 */
export function DuesReport() {
  const t = useTranslations("fees.dues")
  const f = useSchoolFormat()
  const [classId, setClassId] = useState("")
  const [group, setGroup] = useState<AgeGroup | "all">("all")
  const classes = useQuery(classesQuery())
  const report = useQuery(defaultersQuery(classId))

  const asOf = report.data?.asOf ?? ""
  const students = report.data?.students ?? []
  const inGroup = (g: AgeGroup) =>
    students.filter((s) => ageGroup(s, asOf) === g)
  const shown = (group === "all" ? students : inGroup(group))
    .slice()
    .sort((a, b) => a.oldestDueDate.localeCompare(b.oldestDueDate))
  const sum = (list: Defaulter[]) => list.reduce((s, d) => s + d.overdue, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <NativeSelect
          aria-label={t("class")}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <NativeSelectOption value="">{t("allClasses")}</NativeSelectOption>
          {(classes.data ?? [])
            .slice()
            .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
            .map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>

      {report.isPending ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : (
        <div
          role="tablist"
          aria-label={t("groups")}
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          {(["all", ...GROUPS] as const).map((g) => {
            const list = g === "all" ? students : inGroup(g)
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={group === g}
                onClick={() => setGroup(g)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  group === g && "border-primary ring-1 ring-primary",
                  g === "60+" && list.length > 0 && "border-destructive/40"
                )}
              >
                <span className="text-sm text-muted-foreground">
                  {t(`group.${g}`)}
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {f.moneyShort(sum(list))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("students", {
                    count: list.length,
                    n: f.number(list.length),
                  })}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {report.isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : shown.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("classSection")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("oldestDue")}
                </TableHead>
                <TableHead className="text-right">{t("overdue")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((d) => {
                const days = daysOverdue(d.oldestDueDate, asOf)
                return (
                  <TableRow key={d.studentId}>
                    <TableCell>
                      <Link
                        href={`/dashboard/students/${d.studentId}`}
                        className="font-medium hover:underline"
                      >
                        {d.name}
                      </Link>
                      <span className="block font-mono text-xs text-muted-foreground">
                        {d.admissionNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      {d.className} {d.sectionName}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {f.date(d.oldestDueDate)}
                      <span
                        className={cn(
                          "block text-xs",
                          days > 60
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {t("daysLate", { days: f.number(days) })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {f.money(d.overdue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Can permission="fees:collect">
                        <Link
                          href={`/dashboard/fees/collect?student=${d.studentId}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          <BanknoteIcon data-icon="inline-start" />
                          {t("collect")}
                        </Link>
                      </Can>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
