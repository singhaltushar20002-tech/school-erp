"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { BanknoteIcon, BellRingIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button, buttonVariants } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "~/components/ui/empty"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
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
import { isApiError } from "~/lib/api/errors"
import { cn } from "~/lib/utils"

import {
  ageGroup,
  daysOverdue,
  defaultersQuery,
  remindStudents,
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
  const [reminding, setReminding] = useState(false)

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
        {shown.length > 0 && (
          <Can permission="fees:collect">
            <Button
              variant="outline"
              className="ms-auto"
              onClick={() => setReminding(true)}
            >
              <BellRingIcon data-icon="inline-start" />
              {t("remind.button", {
                group: t(`group.${group}`),
                n: f.number(shown.length),
              })}
            </Button>
          </Can>
        )}
      </div>
      {reminding && (
        <RemindDialog
          students={shown}
          groupLabel={t(`group.${group}`)}
          onClose={() => setReminding(false)}
        />
      )}

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

/** Shows who the reminder goes to, then sends it. */
function RemindDialog({
  students,
  groupLabel,
  onClose,
}: {
  students: Defaulter[]
  groupLabel: string
  onClose: () => void
}) {
  const t = useTranslations("fees.dues.remind")
  const f = useSchoolFormat()
  const total = students.reduce((s, d) => s + d.overdue, 0)
  const send = useMutation({
    mutationFn: () => remindStudents(students.map((s) => s.studentId)),
    onSuccess: ({ sent }) => {
      toast.add({
        title: t("sent", { count: sent, n: f.number(sent) }),
        description: t("sentHint"),
        type: "success",
      })
      onClose()
    },
    onError: (error) =>
      toast.add({
        title: t("failed"),
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      }),
  })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title", { group: groupLabel })}</DialogTitle>
          <DialogDescription>
            {t("summary", {
              count: students.length,
              n: f.number(students.length),
              amount: f.money(total),
            })}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
          {students.map((s) => (
            <li key={s.studentId} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 truncate">
                {s.name}{" "}
                <span className="text-muted-foreground">
                  {s.className} {s.sectionName}
                </span>
              </span>
              <span className="font-medium tabular-nums">
                {f.money(s.overdue)}
              </span>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-muted p-3 text-sm">
          {t("preview", {
            name: students[0]?.name ?? "",
            amount: f.money(students[0]?.overdue ?? 0),
            date: f.date(students[0]?.oldestDueDate ?? ""),
          })}
        </p>
        <p className="text-xs text-muted-foreground">{t("channels")}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={send.isPending} onClick={() => send.mutate()}>
            {send.isPending
              ? t("sending")
              : t("send", { n: f.number(students.length) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
