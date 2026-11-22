"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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
import { Label } from "~/components/ui/label"
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select"
import { Skeleton } from "~/components/ui/skeleton"
import { toast } from "~/components/ui/toast"
import { allows } from "~/features/access/permissions"
import { usePermissions } from "~/features/access/use-permissions"
import {
  classesQuery,
  classSubjectsQuery,
  currentSessionQuery,
  sectionsQuery,
} from "~/features/academics/api"
import { staffQuery } from "~/features/onboarding/api"
import { useSchoolFormat } from "~/features/settings/use-school-format"
import { isApiError } from "~/lib/api/errors"

import {
  clearSlot,
  publishTimetable,
  saveSlot,
  sectionSubjectTeachersQuery,
  timetableKeys,
  timetableQuery,
  type Day,
  type TimetableGrid,
} from "../api"
import { WeekGrid } from "./timetable-grid"

/**
 * `/dashboard/academics/timetable`: build a section's week period by
 * period, then publish it to parents and students.
 */
export function TimetableBuilder() {
  const t = useTranslations("timetable")
  const session = useQuery(currentSessionQuery())
  const yearId = session.data?.id ?? ""
  const sections = useQuery({
    ...sectionsQuery(yearId),
    enabled: Boolean(yearId),
  })
  const classes = useQuery(classesQuery())
  const [picked, setPicked] = useState<string | null>(null)
  const level = (id: string) =>
    classes.data?.find((c) => c.id === id)?.level ?? 0
  const className = (id: string) =>
    classes.data?.find((c) => c.id === id)?.name ?? ""
  const list = (sections.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        level(a.classId) - level(b.classId) || a.name.localeCompare(b.name)
    )
  const sectionId = picked ?? list[0]?.id ?? null

  if (session.isPending || sections.isPending)
    return <Skeleton className="h-96 rounded-xl" />
  return (
    <div className="flex flex-col gap-4">
      <NativeSelect
        aria-label={t("section")}
        className="w-fit"
        value={sectionId ?? ""}
        onChange={(e) => setPicked(e.target.value)}
      >
        {list.map((s) => (
          <NativeSelectOption key={s.id} value={s.id}>
            {className(s.classId)} {s.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {sectionId && <Builder key={sectionId} sectionId={sectionId} />}
    </div>
  )
}

function Builder({ sectionId }: { sectionId: string }) {
  const t = useTranslations("timetable")
  const f = useSchoolFormat()
  const queryClient = useQueryClient()
  const grid = useQuery(timetableQuery(sectionId))
  const canEdit = allows(usePermissions(), {
    permission: "timetables:update",
  })
  const [cell, setCell] = useState<{ day: Day; periodId: string } | null>(null)
  const publish = useMutation({
    mutationFn: (on: boolean) => publishTimetable(sectionId, on),
    onSuccess: (data) => {
      queryClient.setQueryData(timetableKeys.grid(sectionId), data)
      toast.add({
        title: data.published ? t("publishedToast") : t("unpublishedToast"),
        type: "success",
      })
    },
  })
  if (grid.isPending) return <Skeleton className="h-96 rounded-xl" />
  if (grid.isError) return null
  const g = grid.data
  if (!g.periods.length) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t("noPeriods")}</EmptyTitle>
          <EmptyDescription>{t("noPeriodsBody")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const filled = g.slots.length
  const total = g.periods.length * g.days.length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {g.published ? (
          <Badge>
            {t("publishedOn", { date: f.date(g.published.at.slice(0, 10)) })}
          </Badge>
        ) : (
          <Badge variant="outline">{t("draft")}</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {t("filled", { filled: f.number(filled), total: f.number(total) })}
        </span>
        {canEdit && (
          <Button
            className="ms-auto"
            variant={g.published ? "outline" : "default"}
            disabled={publish.isPending || (!g.published && filled === 0)}
            onClick={() => publish.mutate(!g.published)}
          >
            {g.published ? (
              <EyeOffIcon data-icon="inline-start" />
            ) : (
              <EyeIcon data-icon="inline-start" />
            )}
            {g.published ? t("unpublish") : t("publish")}
          </Button>
        )}
      </div>
      <WeekGrid
        grid={g}
        onCell={
          canEdit ? (day, periodId) => setCell({ day, periodId }) : undefined
        }
      />
      {cell && (
        <SlotDialog
          grid={g}
          day={cell.day}
          periodId={cell.periodId}
          onClose={() => setCell(null)}
        />
      )}
    </div>
  )
}

function SlotDialog({
  grid,
  day,
  periodId,
  onClose,
}: {
  grid: TimetableGrid
  day: Day
  periodId: string
  onClose: () => void
}) {
  const t = useTranslations("timetable")
  const queryClient = useQueryClient()
  const existing = grid.slots.find(
    (s) => s.dayOfWeek === day && s.periodId === periodId
  )
  const subjects = useQuery(classSubjectsQuery(grid.section.academicYearId))
  const teachers = useQuery(sectionSubjectTeachersQuery(grid.section.id))
  const staff = useQuery(staffQuery())
  const options = (subjects.data ?? [])
    .filter((s) => s.classId === grid.section.classId)
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name))
  const [subjectId, setSubjectId] = useState(existing?.subjectId ?? "")
  const [employeeId, setEmployeeId] = useState(existing?.employeeId ?? "")
  const pickSubject = (id: string) => {
    setSubjectId(id)
    const cs = options.find((o) => o.subjectId === id)
    const teacher = teachers.data?.find((r) => r.classSubjectId === cs?.id)
    if (teacher) setEmployeeId(teacher.employeeId)
  }
  const done = async (message: string) => {
    toast.add({ title: message, type: "success" })
    await queryClient.invalidateQueries({
      queryKey: timetableKeys.grid(grid.section.id),
    })
    onClose()
  }
  const fail = (error: unknown) =>
    toast.add({
      title: t("failed"),
      description: isApiError(error) ? error.message : undefined,
      type: "error",
    })
  const save = useMutation({
    mutationFn: () =>
      saveSlot(existing?.id ?? null, {
        academicYearId: grid.section.academicYearId,
        classId: grid.section.classId,
        sectionId: grid.section.id,
        dayOfWeek: day,
        periodId,
        subjectId,
        employeeId,
      }),
    onSuccess: () => done(t("saved")),
    onError: fail,
  })
  const clear = useMutation({
    mutationFn: () => clearSlot(existing!.id),
    onSuccess: () => done(t("cleared")),
    onError: fail,
  })
  const period = grid.periods.find((p) => p.id === periodId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("cellTitle", {
              day: t(`days.${day}`),
              period: period?.name ?? "",
            })}
          </DialogTitle>
          <DialogDescription>
            {grid.section.className} {grid.section.name}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-subject">{t("subject")}</Label>
            <NativeSelect
              id="slot-subject"
              className="w-full"
              value={subjectId}
              onChange={(e) => pickSubject(e.target.value)}
            >
              <NativeSelectOption value="">
                {t("pickSubject")}
              </NativeSelectOption>
              {options.map((o) => (
                <NativeSelectOption key={o.id} value={o.subjectId}>
                  {o.subject.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-teacher">{t("teacher")}</Label>
            <NativeSelect
              id="slot-teacher"
              className="w-full"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <NativeSelectOption value="">
                {t("pickTeacher")}
              </NativeSelectOption>
              {(staff.data ?? [])
                .slice()
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>
                    {s.fullName}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </div>
        </div>
        <DialogFooter>
          {existing && (
            <Button
              variant="outline"
              className="me-auto"
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
            >
              {t("clear")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!subjectId || !employeeId || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
